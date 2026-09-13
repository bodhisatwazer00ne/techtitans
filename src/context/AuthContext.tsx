import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  applyActionCode,
  updateProfile,
  reload,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth, testConnection, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  directSignUp, 
  directSignIn, 
  directResetPassword,
  getDirectActiveSession, 
  updateDirectSessionDisplayName,
  directSignOut,
  linkGoogleAccount,
  emailToAccountId,
  DirectAuthUser 
} from '../services/accountAuth';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providerId?: string;
}

interface AuthContextType {
  firebaseUser: AuthUser | null;
  loading: boolean;
  isVerified: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, trainerName?: string) => Promise<void>;
  updateUserDisplayName: (newDisplayName: string) => Promise<void>;
  resetPassword: (email: string, newPass: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUserStatus: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    testConnection();

    // Check if there is an existing direct email/password session
    const existingDirect = getDirectActiveSession();
    if (existingDirect) {
      setFirebaseUser(existingDirect);
      setLoading(false);
    }

    // Automatically check for email action codes if redirected from verification link
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');
      if (mode === 'verifyEmail' && oobCode) {
        applyActionCode(auth, oobCode)
          .then(async () => {
            if (auth.currentUser) {
              await reload(auth.currentUser);
              setFirebaseUser({
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName,
                emailVerified: true,
                providerId: 'google.com',
              });
            }
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch((err) => {
            console.warn('Action code error:', err);
          });
      }
    } catch {
      // Ignore URL parse errors
    }

    // Helper to resolve registered trainer display name
    const resolveRegisteredTrainerName = async (email: string | null | undefined, uid: string, fbDisplayName?: string | null): Promise<string> => {
      const cleanEmail = (email || '').toLowerCase().trim();
      const emailPrefix = cleanEmail ? cleanEmail.split('@')[0].toLowerCase() : '';

      // 1. Direct active session
      const direct = getDirectActiveSession();
      if (direct?.displayName && direct.displayName !== 'Trainer' && direct.displayName.toLowerCase() !== emailPrefix) {
        return direct.displayName;
      }

      // 2. Local storage by email or uid
      if (typeof window !== 'undefined' && cleanEmail) {
        const storedByEmail = localStorage.getItem(`liferpg_trainer_name_email_${cleanEmail}`) ||
                              localStorage.getItem(`liferpg_trainer_name_${cleanEmail}`);
        if (storedByEmail && storedByEmail !== 'Trainer' && storedByEmail.toLowerCase() !== emailPrefix) {
          return storedByEmail;
        }
      }
      if (typeof window !== 'undefined' && uid) {
        const storedByUid = localStorage.getItem(`liferpg_trainer_name_${uid}`);
        if (storedByUid && storedByUid !== 'Trainer' && storedByUid.toLowerCase() !== emailPrefix) {
          return storedByUid;
        }
      }

      // 3. Firestore trainerAccounts doc
      if (cleanEmail) {
        try {
          const canonicalId = emailToAccountId(cleanEmail);
          const accSnap = await getDoc(doc(db, 'trainerAccounts', canonicalId));
          if (accSnap.exists()) {
            const accData = accSnap.data();
            if (accData.displayName && accData.displayName !== 'Trainer' && accData.displayName.toLowerCase() !== emailPrefix) {
              return accData.displayName;
            }
          }
        } catch {}
      }

      // 4. Firebase Auth displayName if valid and not email prefix
      if (fbDisplayName && fbDisplayName !== 'Trainer' && fbDisplayName.toLowerCase() !== emailPrefix) {
        return fbDisplayName;
      }

      return 'Trainer';
    };

    // Check for redirect result from Google sign-in
    getRedirectResult(auth)
      .then(async (cred) => {
        if (cred && cred.user) {
          const cleanEmail = cred.user.email?.toLowerCase().trim() || '';
          const canonicalUid = cleanEmail ? emailToAccountId(cleanEmail) : cred.user.uid;
          if (cleanEmail) {
            linkGoogleAccount(cleanEmail, cred.user.uid, cred.user.displayName || '').catch(() => {});
          }
          const finalTrainerName = await resolveRegisteredTrainerName(cred.user.email, canonicalUid, cred.user.displayName);
          setFirebaseUser({
            uid: canonicalUid,
            email: cred.user.email,
            displayName: finalTrainerName,
            emailVerified: cred.user.emailVerified,
            providerId: 'google.com',
          });
        }
      })
      .catch((err) => {
        if (err?.code && err.code.includes('unauthorized-domain')) {
          setAuthError(mapAuthErrorMessage(err.code));
        } else {
          console.warn('Redirect auth result info:', err);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const cleanEmail = user.email?.toLowerCase().trim() || '';
        const canonicalUid = cleanEmail ? emailToAccountId(cleanEmail) : user.uid;

        // If a direct session is active for the same email, keep the session stable with canonical UID
        const direct = getDirectActiveSession();
        const finalTrainerName = await resolveRegisteredTrainerName(user.email, canonicalUid, user.displayName);

        if (direct && direct.email?.toLowerCase() === cleanEmail) {
          setFirebaseUser({
            ...direct,
            uid: canonicalUid,
            displayName: finalTrainerName !== 'Trainer' ? finalTrainerName : direct.displayName || 'Trainer',
          });
        } else {
          setFirebaseUser({
            uid: canonicalUid,
            email: user.email,
            displayName: finalTrainerName,
            emailVerified: user.emailVerified,
            providerId: user.providerData?.[0]?.providerId || 'google.com',
          });
        }
      } else {
        // If not in Firebase Auth, check if a direct session exists
        const direct = getDirectActiveSession();
        if (direct) {
          const cleanEmail = direct.email?.toLowerCase().trim();
          const canonicalUid = cleanEmail ? emailToAccountId(cleanEmail) : direct.uid;
          const finalTrainerName = await resolveRegisteredTrainerName(direct.email, canonicalUid, direct.displayName);
          setFirebaseUser({
            ...direct,
            uid: canonicalUid,
            displayName: finalTrainerName !== 'Trainer' ? finalTrainerName : direct.displayName || 'Trainer',
          });
        } else {
          setFirebaseUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      directSignOut();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      let cred;
      try {
        cred = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        // If popup was blocked by browser, attempt redirect fallback
        if (
          popupErr?.code === 'auth/popup-blocked' ||
          popupErr?.code === 'auth/cancelled-popup-request'
        ) {
          console.warn('Popup blocked, attempting redirect sign-in:', popupErr);
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }

      if (cred && cred.user) {
        const cleanEmail = cred.user.email?.toLowerCase().trim() || '';
        const canonicalUid = cleanEmail ? emailToAccountId(cleanEmail) : cred.user.uid;
        if (cleanEmail) {
          linkGoogleAccount(cleanEmail, cred.user.uid, cred.user.displayName || '').catch(() => {});
        }
        setFirebaseUser({
          uid: canonicalUid,
          email: cred.user.email,
          displayName: cred.user.displayName,
          emailVerified: cred.user.emailVerified,
          providerId: 'google.com',
        });
      }
    } catch (err: any) {
      const msg = mapAuthErrorMessage(err?.code || err?.message || String(err));
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    const cleanEmail = email.trim();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      const msg = 'Please enter both email and password.';
      setAuthError(msg);
      throw new Error(msg);
    }

    try {
      // 1. Direct trainer sign in (checks trainerAccounts, Firestore users collection, and local credentials)
      const directUser = await directSignIn(cleanEmail, cleanPass);
      setFirebaseUser(directUser);
      return;
    } catch (directErr: any) {
      // If error was wrong password, communicate that directly
      if (directErr?.message && directErr.message.includes('Incorrect password')) {
        setAuthError(directErr.message);
        throw directErr;
      }

      // 2. Try Firebase Auth fallback
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        if (cred.user) {
          await reload(cred.user);
          directSignOut();
          const canonicalUid = emailToAccountId(cleanEmail);
          setFirebaseUser({
            uid: canonicalUid,
            email: cred.user.email,
            displayName: cred.user.displayName,
            emailVerified: true,
            providerId: 'password',
          });
          return;
        }
      } catch (fbErr: any) {
        const msg = directErr?.message || mapAuthErrorMessage(fbErr?.code || fbErr?.message);
        setAuthError(msg);
        throw new Error(msg);
      }
    }
  };

  const signUpWithEmail = async (email: string, pass: string, trainerName: string = ''): Promise<void> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      const msg = 'Please enter both email and password.';
      setAuthError(msg);
      throw new Error(msg);
    }
    if (cleanPass.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setAuthError(msg);
      throw new Error(msg);
    }

    try {
      // 1. Direct sign up or claim of existing registered profile
      const directUser = await directSignUp(cleanEmail, cleanPass, trainerName);
      setFirebaseUser(directUser);

      // 2. Background attempt to initialize Firebase Auth user if supported
      createUserWithEmailAndPassword(auth, cleanEmail, cleanPass)
        .then(async (cred) => {
          if (trainerName.trim()) {
            await updateProfile(cred.user, { displayName: trainerName.trim() });
          }
        })
        .catch(() => {});
      return;
    } catch (err: any) {
      const msg = err.message || 'Registration failed. Please try again.';
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string, newPass: string): Promise<void> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    const cleanPass = newPass.trim();

    if (!cleanEmail || !cleanPass) {
      const msg = 'Please enter both email and new password.';
      setAuthError(msg);
      throw new Error(msg);
    }
    if (cleanPass.length < 6) {
      const msg = 'New password must be at least 6 characters.';
      setAuthError(msg);
      throw new Error(msg);
    }

    try {
      const directUser = await directResetPassword(cleanEmail, cleanPass);
      setFirebaseUser(directUser);
    } catch (err: any) {
      const msg = err.message || 'Password reset failed.';
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
      } catch (err: any) {
        const msg = mapAuthErrorMessage(err.code || err.message);
        setAuthError(msg);
        throw new Error(msg);
      }
    }
  };

  const reloadUserStatus = async (): Promise<boolean> => {
    if (firebaseUser) {
      return true;
    }
    return false;
  };

  const updateUserDisplayName = async (newDisplayName: string): Promise<void> => {
    const clean = newDisplayName.trim();
    if (!clean) return;

    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: clean });
      } catch (err) {
        console.warn('Could not update Firebase Auth profile displayName:', err);
      }
    }

    updateDirectSessionDisplayName(clean);

    setFirebaseUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        displayName: clean,
      };
    });
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign out error', err);
    }
    directSignOut();
    setFirebaseUser(null);
  };

  const isVerified = true; // Seamless gameplay: no blocking barriers

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        loading,
        isVerified,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        updateUserDisplayName,
        resendVerificationEmail,
        reloadUserStatus,
        resetPassword,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function mapAuthErrorMessage(codeOrMsg: string): string {
  const currentHost = typeof window !== 'undefined' && window.location.hostname 
    ? window.location.hostname 
    : 'your-app.onrender.com';

  if (
    codeOrMsg.includes('auth/unauthorized-domain') ||
    codeOrMsg.includes('unauthorized-domain')
  ) {
    return `DOMAIN NOT AUTHORIZED: Google Sign-in requires adding "${currentHost}" to your Firebase project. In Firebase Console > Authentication > Settings > Authorized domains, click "Add domain" and enter "${currentHost}". (You can also sign in or register instantly with Trainer Email & Password below!)`;
  }
  if (
    codeOrMsg.includes('auth/operation-not-allowed') ||
    codeOrMsg.includes('OPERATION_NOT_ALLOWED') ||
    codeOrMsg.includes('PASSWORD_LOGIN_DISABLED')
  ) {
    return 'Password sign-in is disabled in Firebase. In Firebase Console > Authentication > Sign-in method, click on Email/Password, ensure the first toggle ("Allow users to sign up using email and password") is ON and click Save. You can also sign in with Google below!';
  }
  if (codeOrMsg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing. Please try again.';
  }
  if (codeOrMsg.includes('auth/cancelled-popup-request')) {
    return 'Google sign-in was cancelled. Please try again.';
  }
  if (codeOrMsg.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by browser. Please allow popups for this site.';
  }
  if (codeOrMsg.includes('auth/invalid-email')) {
    return 'Invalid email address format.';
  }
  if (codeOrMsg.includes('auth/user-not-found') || codeOrMsg.includes('auth/invalid-credential')) {
    return 'Invalid email or password.';
  }
  if (codeOrMsg.includes('auth/wrong-password')) {
    return 'Incorrect password.';
  }
  if (codeOrMsg.includes('auth/email-already-in-use')) {
    return 'This email is already registered. Please sign in instead.';
  }
  if (codeOrMsg.includes('auth/weak-password')) {
    return 'Password should be at least 6 characters.';
  }
  if (codeOrMsg.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return codeOrMsg || 'Authentication failed. Please try again.';
}
