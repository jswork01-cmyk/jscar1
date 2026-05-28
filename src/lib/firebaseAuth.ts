import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request the Google Sheets and Drive permissions
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory and local storage
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('welfare_vehicle_google_token') : null;
let cachedUser: any = null;

// Read user profile from local storage if available
if (typeof window !== 'undefined') {
  const storedUser = localStorage.getItem('welfare_vehicle_user_profile');
  if (storedUser) {
    try {
      cachedUser = JSON.parse(storedUser);
    } catch (e) {
      console.error(e);
    }
  }
}

// Helpers for Custom Client ID and Direct Tokens
export const getCustomClientId = (): string => {
  if (typeof window === 'undefined') return '';
  const fromStore = localStorage.getItem('welfare_google_custom_client_id');
  if (fromStore) return fromStore;
  
  // Support environment variable
  // @ts-ignore
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
};

export const saveCustomClientId = (clientId: string) => {
  if (typeof window !== 'undefined') {
    if (clientId) {
      localStorage.setItem('welfare_google_custom_client_id', clientId.trim());
    } else {
      localStorage.removeItem('welfare_google_custom_client_id');
    }
  }
};

// Fetch Google User Profile using Direct Access Token
export const fetchGoogleUserProfile = async (token: string): Promise<any> => {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error('Google 사용자 프로필을 불러오는데 실패하였습니다. 토큰이 무효하거나 만료되었을 수 있습니다.');
  }
  const data = await response.json();
  return {
    uid: 'google_direct:' + data.sub,
    email: data.email,
    displayName: data.name || data.given_name || '구글 사용자',
    photoURL: data.picture || ''
  };
};

// Check and process OAuth redirects/hash parameters
if (typeof window !== 'undefined') {
  const processOAuthHashAndParameters = () => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const error = params.get('error');
      
      // If we are inside an opened OAuth popup, post message back to the creator window and close
      if (window.opener) {
        if (accessToken) {
          window.opener.postMessage({ type: 'DIRECT_GOOGLE_AUTH_SUCCESS', accessToken }, '*');
          window.close();
          return true;
        } else if (error) {
          window.opener.postMessage({ type: 'DIRECT_GOOGLE_AUTH_FAILURE', error }, '*');
          window.close();
          return true;
        }
      } else {
        // If it's a redirect in the same main window, capture and process it directly
        if (accessToken) {
          cachedAccessToken = accessToken;
          localStorage.setItem('welfare_vehicle_google_token', accessToken);
          
          // Clear address bar hash nicely without refreshing
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          
          fetchGoogleUserProfile(accessToken)
            .then(profile => {
              cachedUser = profile;
              localStorage.setItem('welfare_vehicle_user_profile', JSON.stringify(profile));
              window.location.reload(); // Refresh to broadcast state
            })
            .catch(console.error);
        }
      }
    }
    return false;
  };
  
  processOAuthHashAndParameters();
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check direct oauth or manual token first
  if (typeof window !== 'undefined') {
    const directToken = localStorage.getItem('welfare_vehicle_google_token');
    const directUserStr = localStorage.getItem('welfare_vehicle_user_profile');
    
    if (directToken && directUserStr) {
      try {
        const parsedProfile = JSON.parse(directUserStr);
        cachedAccessToken = directToken;
        cachedUser = parsedProfile;
        
        // Trigger success immediately after a small delay to let parent render
        setTimeout(() => {
          if (onAuthSuccess) {
            onAuthSuccess(parsedProfile as User, directToken);
          }
        }, 100);
        
        // Return a dummy unsubscribe function
        return () => {};
      } catch (e) {
        console.error('Error loading stored custom profile:', e);
      }
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Look up cached token in memory/localStorage first
      const currentToken = cachedAccessToken || localStorage.getItem('welfare_vehicle_google_token');
      if (currentToken) {
        cachedAccessToken = currentToken;
        if (onAuthSuccess) onAuthSuccess(user, currentToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // Only clear if we don't have Custom OAuth user profile
      const directUserStr = localStorage.getItem('welfare_vehicle_user_profile');
      if (!directUserStr || !directUserStr.includes('google_direct')) {
        cachedAccessToken = null;
        localStorage.removeItem('welfare_vehicle_google_token');
        localStorage.removeItem('welfare_vehicle_user_profile');
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('welfare_vehicle_google_token', cachedAccessToken);
    
    const profile = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL
    };
    cachedUser = profile;
    localStorage.setItem('welfare_vehicle_user_profile', JSON.stringify(profile));

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Custom Direct Google Login with Custom Client ID (Popup-based)
export const directGoogleSignInWithOptions = async (clientId: string, useRedirect = false): Promise<{ user: any; accessToken: string }> => {
  if (!clientId || !clientId.trim()) {
    throw new Error('구글 OAuth Web Client ID가 제공되지 않았습니다. 설정 탭에서 복사한 Client ID를 먼저 입력해 주십시오.');
  }

  const cleanClientId = clientId.trim();
  const redirectUri = window.location.origin; // Redirect back to this applet URL
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${encodeURIComponent(cleanClientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&prompt=select_account`;

  if (useRedirect) {
    window.location.href = authUrl;
    return new Promise(() => {}); // never resolves as page redirects
  }

  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      'google_direct_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup) {
      reject(new Error('로그인 팝업이 브라우저에 의해 차단되었습니다. 팝업 차단을 해제하거나 리다이렉트 로그인 방식을 이용해 주십시오.'));
      return;
    }

    const messageListener = async (event: MessageEvent) => {
      // Security: Validate origin is from this app's own origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'DIRECT_GOOGLE_AUTH_SUCCESS') {
        window.removeEventListener('message', messageListener);
        const token = event.data.accessToken;
        
        try {
          const profile = await fetchGoogleUserProfile(token);
          cachedAccessToken = token;
          cachedUser = profile;
          localStorage.setItem('welfare_vehicle_google_token', token);
          localStorage.setItem('welfare_vehicle_user_profile', JSON.stringify(profile));
          resolve({ user: profile, accessToken: token });
        } catch (err) {
          reject(err);
        }
      } else if (event.data?.type === 'DIRECT_GOOGLE_AUTH_FAILURE') {
        window.removeEventListener('message', messageListener);
        reject(new Error(`구글 로그인 실패: ${event.data.error || '사용자가 거부했습니다.'}`));
      }
    };

    window.addEventListener('message', messageListener);

    // Watch for popup closed by user
    const checkClosedInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosedInterval);
        setTimeout(() => {
          window.removeEventListener('message', messageListener);
          reject(new Error('사용자가 로그인 창을 닫았습니다.'));
        }, 1000);
      }
    }, 500);
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('welfare_vehicle_google_token');
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    console.warn("Firebase logout warning:", e);
  }
  cachedAccessToken = null;
  cachedUser = null;
  localStorage.removeItem('welfare_vehicle_google_token');
  localStorage.removeItem('welfare_vehicle_user_profile');
};
