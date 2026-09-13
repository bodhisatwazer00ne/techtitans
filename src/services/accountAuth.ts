import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, sanitizeForFirestore, checkUsernameAvailable, claimUniqueUsername, syncPublicTrainerProfile } from './firebase';
import { createInitialState, saveGameState } from './storage';

export interface DirectAuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  providerId: 'password' | 'google.com';
}

interface StoredAccount {
  uid: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  createdAt: string;
}

export interface FoundTrainerInfo {
  source: 'trainerAccounts' | 'users' | 'local';
  uid: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  salt?: string;
}

const STORAGE_SESSION_KEY = 'liferpg_direct_session_v1';
const STORAGE_ACCOUNTS_KEY = 'liferpg_direct_accounts_v1';

// Convert email to a URL/Firestore-safe document ID
export function emailToAccountId(email: string): string {
  const clean = email.toLowerCase().trim();
  try {
    return 'acc_' + btoa(clean).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  } catch {
    return 'acc_' + clean.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

// Generate cryptographically secure random salt
function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Hash password with salt using Web Crypto SHA-256
async function hashPassword(password: string, salt: string): Promise<string> {
  const message = `salt:${salt}:pass:${password}:liferpg_v1`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(message);
    const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback string hashing if Web Crypto is unavailable
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const chr = message.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return 'fb_' + Math.abs(hash).toString(16);
}

function getLocalAccounts(): Record<string, StoredAccount> {
  try {
    const data = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveLocalAccount(account: StoredAccount): void {
  try {
    const accounts = getLocalAccounts();
    accounts[account.email.toLowerCase().trim()] = account;
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Failed to save account locally:', err);
  }
}

export function getDirectActiveSession(): DirectAuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.email) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setDirectActiveSession(user: DirectAuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
      const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
      if (cleanEmail && user.displayName && user.displayName !== 'Trainer') {
        localStorage.setItem(`liferpg_trainer_name_email_${cleanEmail}`, user.displayName);
        localStorage.setItem(`liferpg_username_claimed_email_${cleanEmail}`, 'true');
        localStorage.setItem(`liferpg_claimed_email_${cleanEmail}`, 'true');
      }
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch (err) {
    console.warn('Failed to write direct session:', err);
  }
}

// Resilient account finder: checks trainerAccounts, local storage, AND users collection
export async function findExistingAccountOrUser(email: string): Promise<FoundTrainerInfo | null> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return null;

  const accountId = emailToAccountId(cleanEmail);

  // 1. Check trainerAccounts by document ID
  try {
    const snap = await getDoc(doc(db, 'trainerAccounts', accountId));
    if (snap.exists()) {
      const data = snap.data() as StoredAccount;
      return {
        source: 'trainerAccounts',
        uid: accountId, // Canonical UID is always accountId
        email: data.email || cleanEmail,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        salt: data.salt,
      };
    }
  } catch (err) {
    console.warn('trainerAccounts getDoc check warning:', err);
  }

  // 2. Query trainerAccounts by email field
  try {
    const qAcc = query(collection(db, 'trainerAccounts'), where('email', '==', cleanEmail));
    const snapAcc = await getDocs(qAcc);
    if (!snapAcc.empty) {
      const data = snapAcc.docs[0].data() as StoredAccount;
      return {
        source: 'trainerAccounts',
        uid: accountId, // Canonical UID
        email: data.email || cleanEmail,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        salt: data.salt,
      };
    }
  } catch (err) {
    console.warn('trainerAccounts query check warning:', err);
  }

  // 3. Query users collection by email field (for accounts registered previously or via Google)
  try {
    const qUser = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snapUser = await getDocs(qUser);
    if (!snapUser.empty) {
      const docSnap = snapUser.docs[0];
      const data = docSnap.data();
      const emailPrefix = cleanEmail.split('@')[0].toLowerCase();
      let displayName = data.displayName || data.user?.username;
      if (displayName && (displayName.toLowerCase() === emailPrefix || displayName === 'Trainer')) {
        displayName = null;
      }
      return {
        source: 'users',
        uid: accountId, // Canonical UID
        email: cleanEmail,
        displayName: displayName || undefined,
      };
    }
  } catch (err) {
    console.warn('users query check warning:', err);
  }

  // 4. Fallback check local accounts
  const local = getLocalAccounts();
  if (local[cleanEmail]) {
    const data = local[cleanEmail];
    return {
      source: 'local',
      uid: accountId, // Canonical UID
      email: data.email || cleanEmail,
      displayName: data.displayName,
      passwordHash: data.passwordHash,
      salt: data.salt,
    };
  }

  return null;
}

export async function directSignUp(
  email: string,
  pass: string,
  displayName: string = ''
): Promise<DirectAuthUser> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!pass || pass.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const cleanUsername = displayName.trim();
  if (!cleanUsername) {
    throw new Error('Please enter a username for your trainer.');
  }
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    throw new Error('Username must be between 3 and 20 characters.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens.');
  }

  const existing = await findExistingAccountOrUser(cleanEmail);
  const accountId = emailToAccountId(cleanEmail);

  // If user already exists in trainerAccounts with password credentials
  if (existing && existing.passwordHash && existing.salt) {
    throw new Error('An account with this email address already exists. Please log in or use "SET PASS" if you need to reset your password.');
  }

  // Check username uniqueness
  const availability = await checkUsernameAvailable(cleanUsername, existing?.uid || accountId);
  if (!availability.available) {
    throw new Error(availability.error || `Username "${cleanUsername}" is already taken by another trainer. Please choose a different username.`);
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(pass, salt);
  const uid = existing?.uid || accountId;

  const newAccount: StoredAccount = {
    uid,
    email: cleanEmail,
    passwordHash,
    salt,
    displayName: cleanUsername,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'trainerAccounts', accountId), sanitizeForFirestore(newAccount), { merge: true });
  } catch (err) {
    console.warn('Failed to save trainer account to Firestore, keeping local:', err);
  }
  saveLocalAccount(newAccount);

  // Claim the unique username across Firestore /usernames and /users
  await claimUniqueUsername(uid, cleanUsername, cleanEmail);

  // Initialize and persist clean GameState for this user
  const initialState = createInitialState(cleanUsername, uid);
  initialState.hasClaimedUsername = true;
  saveGameState(initialState, uid);

  // Publish public trainer profile so this player immediately appears in the Arena and leaderboard
  await syncPublicTrainerProfile(uid, initialState.user, 0, 0);

  // Cache trainer credentials in local storage
  try {
    localStorage.setItem(`liferpg_username_claimed_${uid}`, 'true');
    localStorage.setItem(`liferpg_trainer_name_${uid}`, cleanUsername);
    localStorage.setItem(`liferpg_username_claimed_email_${cleanEmail}`, 'true');
    localStorage.setItem(`liferpg_trainer_name_email_${cleanEmail}`, cleanUsername);
  } catch (err) {
    console.warn('Local storage cache warning:', err);
  }

  const authUser: DirectAuthUser = {
    uid,
    email: cleanEmail,
    displayName: cleanUsername,
    emailVerified: true,
    providerId: 'password',
  };

  setDirectActiveSession(authUser);
  return authUser;
}

export async function directSignIn(
  email: string,
  pass: string
): Promise<DirectAuthUser> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!pass) {
    throw new Error('Please enter your password.');
  }

  // 1. Check existing accounts in trainerAccounts, users collection, and local storage
  const existing = await findExistingAccountOrUser(cleanEmail);

  if (existing) {
    // Case A: Has password hash stored
    if (existing.passwordHash && existing.salt) {
      const computedHash = await hashPassword(pass, existing.salt);
      if (computedHash !== existing.passwordHash) {
        throw new Error('Incorrect password. Click "RESET PASSWORD" if you forgot it.');
      }

      const emailPrefix = cleanEmail.split('@')[0].toLowerCase();
      const resolvedName = 
        existing.displayName && existing.displayName.toLowerCase() !== emailPrefix
          ? existing.displayName
          : 'Trainer';

      const authUser: DirectAuthUser = {
        uid: existing.uid,
        email: cleanEmail,
        displayName: resolvedName,
        emailVerified: true,
        providerId: 'password',
      };
      setDirectActiveSession(authUser);
      return authUser;
    }

    // Case B: Registered in users collection from earlier Google auth or cloud session without password
    // Initialize their password credentials right now and log them in seamlessly!
    const emailPrefix = cleanEmail.split('@')[0].toLowerCase();
    const resolvedName = 
      existing.displayName && existing.displayName.toLowerCase() !== emailPrefix
        ? existing.displayName
        : 'Trainer';

    const salt = generateSalt();
    const passwordHash = await hashPassword(pass, salt);
    const newAccount: StoredAccount = {
      uid: existing.uid,
      email: cleanEmail,
      passwordHash,
      salt,
      displayName: resolvedName,
      createdAt: new Date().toISOString(),
    };

    const accountId = emailToAccountId(cleanEmail);
    try {
      await setDoc(doc(db, 'trainerAccounts', accountId), sanitizeForFirestore(newAccount), { merge: true });
    } catch (err) {
      console.warn('Failed to store account credentials in Firestore:', err);
    }
    saveLocalAccount(newAccount);

    const authUser: DirectAuthUser = {
      uid: existing.uid,
      email: cleanEmail,
      displayName: resolvedName,
      emailVerified: true,
      providerId: 'password',
    };
    setDirectActiveSession(authUser);
    return authUser;
  }

  // Case C: If no account was found, prompt user to register and choose their username
  throw new Error('No account found with this email address. Please click "REGISTER" above to choose your trainer username.');
}

// Reset / Update Password seamlessly for any trainer
export async function directResetPassword(
  email: string,
  newPass: string
): Promise<DirectAuthUser> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!newPass || newPass.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const existing = await findExistingAccountOrUser(cleanEmail);
  const accountId = emailToAccountId(cleanEmail);
  const uid = existing?.uid || accountId;
  const emailPrefix = cleanEmail.split('@')[0].toLowerCase();
  const displayName = 
    existing?.displayName && existing.displayName.toLowerCase() !== emailPrefix
      ? existing.displayName
      : 'Trainer';

  const salt = generateSalt();
  const passwordHash = await hashPassword(newPass, salt);

  const account: StoredAccount = {
    uid,
    email: cleanEmail,
    passwordHash,
    salt,
    displayName,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'trainerAccounts', accountId), sanitizeForFirestore(account), { merge: true });
  } catch (err) {
    console.warn('Failed to reset password in Firestore:', err);
  }
  saveLocalAccount(account);

  const authUser: DirectAuthUser = {
    uid,
    email: cleanEmail,
    displayName,
    emailVerified: true,
    providerId: 'password',
  };
  setDirectActiveSession(authUser);
  return authUser;
}

// Link Google account to trainerAccounts so direct sign-in and Google sign-in share the exact same UID
export async function linkGoogleAccount(email: string, googleUid: string, displayName: string = ''): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return;

  const accountId = emailToAccountId(cleanEmail);
  const emailPrefix = cleanEmail.split('@')[0].toLowerCase();

  try {
    // Preserve any existing registered trainer name!
    const existingSnap = await getDoc(doc(db, 'trainerAccounts', accountId));
    let finalDisplayName: string | null = null;
    if (existingSnap.exists()) {
      const d = existingSnap.data();
      if (d.displayName && d.displayName !== 'Trainer' && d.displayName.toLowerCase() !== emailPrefix) {
        finalDisplayName = d.displayName;
      }
    }

    if (!finalDisplayName && displayName && displayName !== 'Trainer' && displayName.toLowerCase() !== emailPrefix) {
      finalDisplayName = displayName;
    }

    const payload: Record<string, any> = {
      uid: accountId,
      googleUid: googleUid,
      email: cleanEmail,
      updatedAt: new Date().toISOString(),
    };
    if (finalDisplayName) {
      payload.displayName = finalDisplayName;
    }

    await setDoc(
      doc(db, 'trainerAccounts', accountId),
      sanitizeForFirestore(payload),
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not link Google account to trainerAccounts:', err);
  }
}

export function updateDirectSessionDisplayName(newDisplayName: string): void {
  const session = getDirectActiveSession();
  if (session) {
    session.displayName = newDisplayName;
    setDirectActiveSession(session);
  }
}

export function directSignOut(): void {
  setDirectActiveSession(null);
}

