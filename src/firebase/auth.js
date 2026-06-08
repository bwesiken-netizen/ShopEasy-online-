import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

const functions = getFunctions(auth.app);

export const sendOTP = httpsCallable(functions, 'sendEmailOTP');
export const verifyOTP = httpsCallable(functions, 'verifyEmailOTP');

export { signInWithCustomToken, onAuthStateChanged, signOut, auth };

export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
