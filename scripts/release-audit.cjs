const fs = require('fs');
const path = require('path');
const root = process.cwd();
const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const appJsonSource = read('app.json');
const app = JSON.parse(appJsonSource).expo;
const packageJson = readJson('package.json');
const firebaseRc = readJson('.firebaserc');
const firebaseJson = readJson('firebase.json');
const appSource = read('App.tsx');
const firestoreSource = read('src/firestore.ts');
const firebaseSource = read('src/firebase.ts');
const googleSource = read('src/google-sign-in.ts');
const revenueCatSource = read('src/revenuecat.ts');
const adsSource = read('src/ads.tsx');
const rulesSource = read('firestore.rules');
const storageRulesSource = read('storage.rules');
const publicProfileSync = firestoreSource.slice(
  firestoreSource.indexOf('export async function syncPublicUserProfile'),
  firestoreSource.indexOf('export async function upsertUserProfile')
);

check(firebaseRc.projects?.default === 'spark-70b03', 'Default Firebase project must be spark-70b03.');
check(app.ios?.bundleIdentifier === 'com.sparknew.connect', 'Unexpected iOS bundle identifier.');
check(app.android?.package === 'com.sparknew.connect', 'Unexpected Android package identifier.');
check(app.ios?.usesAppleSignIn === true, 'Sign in with Apple must be enabled.');
check(app.plugins?.includes('expo-apple-authentication'), 'Apple Authentication Expo plugin is missing.');
check(app.ios?.infoPlist?.NSPhotoLibraryUsageDescription?.length > 20, 'iOS photo-library usage description is missing.');
check(app.ios?.infoPlist?.NSLocationWhenInUseUsageDescription?.length > 20, 'iOS location usage description is missing.');
check(app.ios.infoPlist.NSLocationWhenInUseUsageDescription.includes('u\u017cywa') && app.ios.infoPlist.NSPhotoLibraryUsageDescription.includes('zdj\u0119'), 'iOS permission descriptions contain broken Polish text.');
check(app.ios?.privacyManifests?.NSPrivacyTracking === false, 'iOS privacy manifest must declare tracking disabled.');
check(Array.isArray(app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes), 'iOS collected-data privacy manifest is missing.');
check(Array.isArray(app.scheme) && app.scheme.includes('sparkconnect') && app.scheme.includes('rc-c14d769c6c'), 'Required app URL schemes are missing.');
check(firebaseJson.firestore?.rules === 'firestore.rules', 'Firestore rules are not wired in firebase.json.');
check(firebaseJson.storage?.rules === 'storage.rules', 'Storage rules are not wired in firebase.json.');
check(firebaseSource.includes('projectId: "spark-70b03"'), 'Firebase runtime defaults point to the wrong project.');
check(firebaseSource.includes('storageBucket: "spark-70b03.firebasestorage.app"'), 'Firebase runtime storage bucket is wrong.');
check(googleSource.includes('defaultGoogleClientIds') && googleSource.includes('.apps.googleusercontent.com'), 'Production Google client ID fallback is missing.');
check(revenueCatSource.includes('__DEV__ ? "test_') && revenueCatSource.includes('!apiKey.startsWith("test_")'), 'RevenueCat simulated key guard is missing.');
check(adsSource.includes('showPrivacyOptionsForm') && adsSource.includes('requestNonPersonalizedAdsOnly: true'), 'Ad consent/privacy protections are incomplete.');
check(rulesSource.includes('hasRevenueCatPro()') && rulesSource.includes('validPremiumUsageUpdate()'), 'Premium Firestore protections are missing.');
check(rulesSource.includes('activeEntitlements') && !rulesSource.includes('revenueCatEntitlements'), 'RevenueCat Firebase claim name must be activeEntitlements.');
check(rulesSource.includes("data.source == 'premium-request' && data.status == 'requested' && hasRevenueCatPro()"), 'Premium chat requests must be enforced by Firestore.');
check(rulesSource.includes('data.photoUrls.size() <= (hasRevenueCatPro() ? 15 : 3)'), 'Free and Pro public photo limits must be enforced by Firestore.');
check(storageRulesSource.includes('request.resource.size < 8 * 1024 * 1024') && storageRulesSource.includes("contentType.matches('image/.*')"), 'Profile photo storage validation is missing.');
check(firestoreSource.includes('getApproximatePublicLocation(profile.location)'), 'Public profile location must be rounded before publishing.');
check(firestoreSource.includes('.slice(0, claimIsPro ? 15 : 3)') && firestoreSource.includes('publicMainPhotoUrl'), 'Expired Pro profiles must publish at most three photos.');
check(!/\bemail\s*:/.test(publicProfileSync), 'Public profile sync must not expose email.');
check(!/\bbirthDate\s*:/.test(publicProfileSync), 'Public profile sync must not expose birth date.');
check(appSource.includes('deleteCurrentUserAccount') && appSource.includes('requestAccountDeletionAndDeleteProfile'), 'In-app account deletion is missing.');
check(appSource.includes('signInWithAppleIdToken') && appSource.includes('signInWithGoogleIdToken'), 'Required social login paths are missing.');
check(appSource.includes('showCurrentBanner ? 92 : 0'), 'Discover layout must reserve space for the native ad banner.');
check(appSource.includes('getProfileKey(profile) !== appUser?.uid'), 'Discovery feed must exclude the signed-in user.');
check(appSource.includes('LocationControl') && appSource.includes('Location.getForegroundPermissionsAsync()') && appSource.includes('updateCurrentLocation(true)'), 'Location permission must be contextual and user initiated.');
check(appSource.includes('openAdsPrivacyOptions'), 'In-app ad privacy settings entry is missing.');
check(appSource.includes('Subskrypcja odnawia si\\u0119 automatycznie') && appSource.includes('zakupem jednorazowym bez automatycznego odnawiania'), 'App Store subscription billing disclosure is missing.');
check(appSource.includes('__DEV__ && process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN'), 'Demo login must be development-only.');
check(appSource.includes('__DEV__ && process.env.EXPO_PUBLIC_SHOW_TEST_PROFILES'), 'Extra test-profile injection must be development-only.');

for (const [name, source] of Object.entries({ 'app.json': appJsonSource, 'App.tsx': appSource, 'src/firestore.ts': firestoreSource })) {
  check(!source.includes('\uFFFD'), `${name} contains a Unicode replacement character.`);
  check(!/[ÃÅÄ][^\s]/.test(source), `${name} contains likely UTF-8 mojibake.`);
  check(!/Nie uda\?o|Spr\?buj|zablokowac|Szukaj prosb/.test(source), `${name} contains broken Polish UI text.`);
}

const icon = fs.readFileSync(path.join(root, app.icon));
check(icon.toString('ascii', 1, 4) === 'PNG', 'App icon is not a PNG.');
check(icon.readUInt32BE(16) === 1024 && icon.readUInt32BE(20) === 1024, 'App icon must be 1024x1024.');
check(icon[25] === 2, 'App icon must be opaque RGB without an alpha channel.');
check(packageJson.dependencies?.['expo-apple-authentication'], 'Apple Authentication dependency is missing.');
check(packageJson.dependencies?.['react-native-purchases'], 'RevenueCat dependency is missing.');
check(packageJson.dependencies?.['react-native-google-mobile-ads'], 'Google Mobile Ads dependency is missing.');

if (failures.length) {
  console.error(`Release audit failed (${failures.length}/${checks}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Release audit passed: ${checks} checks.`);
