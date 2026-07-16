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
const codemagicSource = read('codemagic.yaml');
const app = JSON.parse(appJsonSource).expo;
const packageJson = readJson('package.json');
const firebaseRc = readJson('.firebaserc');
const firebaseJson = readJson('firebase.json');
const appSource = read('App.tsx');
const appConfigSource = read('app.config.js');
const authSource = read('src/auth.ts');
const firestoreSource = read('src/firestore.ts');
const firebaseSource = read('src/firebase.ts');
const googleSource = read('src/google-sign-in.ts');
const googlePlistSource = read('GoogleService-Info.plist');
const revenueCatSource = read('src/revenuecat.ts');
const adsSource = read('src/ads.tsx');
const rulesSource = read('firestore.rules');
const storageRulesSource = read('storage.rules');
const notificationsSource = read('src/notifications.ts');
const functionsSource = read('functions/src/index.ts');
const publicProfileSync = firestoreSource.slice(
  firestoreSource.indexOf('export async function syncPublicUserProfile'),
  firestoreSource.indexOf('export async function upsertUserProfile')
);

check(firebaseRc.projects?.default === 'spark-70b03', 'Default Firebase project must be spark-70b03.');
const productionSources = [appJsonSource, codemagicSource, appSource, firebaseSource, firestoreSource, notificationsSource, functionsSource, rulesSource, storageRulesSource, JSON.stringify(firebaseRc), JSON.stringify(firebaseJson)].join('\n').toLowerCase();
check(!productionSources.includes('fame4help'), 'Spark production files must never reference Fame4Help.');
check(app.ios?.bundleIdentifier === 'com.sparknew.connect', 'Unexpected iOS bundle identifier.');
check(app.android?.package === 'com.sparknew.connect', 'Unexpected Android package identifier.');
check(app.ios?.usesAppleSignIn === true, 'Sign in with Apple capability must be enabled.');
const buildPropertiesPlugin = app.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
check(buildPropertiesPlugin?.[1]?.ios?.useFrameworks === 'static', 'iOS must use Firebase-supported static frameworks.');
check(codemagicSource.includes("props['ios.useFrameworks'] !== 'static'"), 'Codemagic must verify static iOS frameworks before installing pods.');
check(app.plugins?.includes('expo-apple-authentication'), 'Apple Authentication Expo plugin must be configured.');
check(app.plugins?.includes('@react-native-google-signin/google-signin'), 'Google Sign-In Expo plugin must be configured.');
check(codemagicSource.includes('APP_STORE_CONNECT_MAX_BUILD_PROCESSING_WAIT: \"60\"'), 'Codemagic must allow enough time for App Store Connect processing.');
check(app.ios?.infoPlist?.NSPhotoLibraryUsageDescription?.length > 20, 'iOS photo-library usage description is missing.');
check(app.ios?.infoPlist?.NSLocationWhenInUseUsageDescription?.length > 20, 'iOS location usage description is missing.');
check(app.ios?.infoPlist?.NSMotionUsageDescription?.length > 20, 'iOS motion usage description is missing.');
check(!appConfigSource.includes('delete plist.NSMotionUsageDescription'), 'iOS config must preserve the motion usage description.');
check(app.ios.infoPlist.NSLocationWhenInUseUsageDescription.includes('u\u017cywa') && app.ios.infoPlist.NSPhotoLibraryUsageDescription.includes('zdj\u0119'), 'iOS permission descriptions contain broken Polish text.');
check(app.ios?.privacyManifests?.NSPrivacyTracking === false, 'iOS privacy manifest must declare tracking disabled.');
check(Array.isArray(app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes), 'iOS collected-data privacy manifest is missing.');
const privacyTypes = app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes?.map((item) => item.NSPrivacyCollectedDataType) ?? [];
check(['NSPrivacyCollectedDataTypeDeviceID', 'NSPrivacyCollectedDataTypeAdvertisingData', 'NSPrivacyCollectedDataTypeCrashData', 'NSPrivacyCollectedDataTypePerformanceData'].every((type) => privacyTypes.includes(type)), 'Google Mobile Ads privacy disclosures are incomplete.');
check(Array.isArray(app.scheme) && app.scheme.includes('sparkconnect') && app.scheme.includes('rc-c14d769c6c'), 'Required app URL schemes are missing.');
check(firebaseJson.firestore?.rules === 'firestore.rules', 'Firestore rules are not wired in firebase.json.');
check(firebaseJson.storage?.rules === 'storage.rules', 'Storage rules are not wired in firebase.json.');
check(Boolean(firebaseJson.auth?.providers?.googleSignIn), 'Google auth provider must remain enabled in release configuration.');
check(firebaseSource.includes('projectId: "spark-70b03"'), 'Firebase runtime defaults point to the wrong project.');
check(firebaseSource.includes('storageBucket: "spark-70b03.firebasestorage.app"'), 'Firebase runtime storage bucket is wrong.');
check(googleSource.includes('defaultGoogleClientIds') && googleSource.includes('.apps.googleusercontent.com'), 'Production Google client ID fallback is missing.');
check(googlePlistSource.includes('com.googleusercontent.apps.271339297035-320oq6h9pcmdn5kk75k5fg8igo9ht0h0') && googleSource.includes('271339297035-320oq6h9pcmdn5kk75k5fg8igo9ht0h0.apps.googleusercontent.com'), 'Google iOS redirect scheme and client ID are inconsistent.');
check(revenueCatSource.includes('__DEV__ ? "test_') && revenueCatSource.includes('!apiKey.startsWith("test_")'), 'RevenueCat simulated key guard is missing.');
check(adsSource.includes('showPrivacyOptionsForm') && adsSource.includes('requestNonPersonalizedAdsOnly: true'), 'Ad consent/privacy protections are incomplete.');
check(rulesSource.includes('hasRevenueCatPro()') && rulesSource.includes('validPremiumUsageUpdate()'), 'Premium Firestore protections are missing.');
check(rulesSource.includes('activeEntitlements') && !rulesSource.includes('revenueCatEntitlements'), 'RevenueCat Firebase claim name must be activeEntitlements.');
check(rulesSource.includes('allowedUserText') && appSource.includes('findModerationViolation'), 'UGC text filtering is missing.');
check(appSource.includes('onReportProfile(description)') && appSource.includes('targetProfile: targetProfile ?'), 'In-app reporting must preserve the user reason and profile context.');
check(appSource.indexOf('requestAccountDeletionAndDeleteProfile') < appSource.indexOf('deleteProfilePhotos(appUser.uid, profilePhotos)'), 'Account deletion request must not be blocked by photo cleanup.');
check(rulesSource.includes("data.source == 'premium-request' && data.status == 'requested' && hasRevenueCatPro()"), 'Premium chat requests must be enforced by Firestore.');
check(rulesSource.includes('data.photoUrls.size() <= (hasRevenueCatPro() ? 15 : 3)'), 'Free and Pro public photo limits must be enforced by Firestore.');
check(storageRulesSource.includes('request.resource.size < 8 * 1024 * 1024') && storageRulesSource.includes("contentType.matches('image/.*')"), 'Profile photo storage validation is missing.');
check(firestoreSource.includes('getApproximatePublicLocation(profile.location)'), 'Public profile location must be rounded before publishing.');
check(firestoreSource.includes('.slice(0, claimIsPro ? 15 : 3)') && firestoreSource.includes('publicMainPhotoUrl'), 'Expired Pro profiles must publish at most three photos.');
check(!/\bemail\s*:/.test(publicProfileSync), 'Public profile sync must not expose email.');
check(!/\bbirthDate\s*:/.test(publicProfileSync), 'Public profile sync must not expose birth date.');
check(appSource.includes('deleteCurrentUserAccount') && appSource.includes('requestAccountDeletionAndDeleteProfile'), 'In-app account deletion is missing.');
check(authSource.includes('reauthenticateAndRevokeApple') && authSource.includes('accounts:revokeToken') && authSource.includes('tokenType: "CODE"'), 'Apple token revocation before account deletion is missing.');
check(appSource.includes('AppleAuthentication.signInAsync') && appSource.includes('signInWithAppleIdToken') && appSource.includes('GoogleSignin.configure') && appSource.includes('signInWithGoogleIdToken'), 'Apple and Google login configuration is incomplete.');
check(appSource.includes('/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/') && authSource.includes('/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/'), 'Email validation regex must reject whitespace and require a domain suffix.');
check(appSource.includes('scrollEnabled={tab !== "discover"}') && appSource.includes('showCurrentBanner && tab !== "discover"') && appSource.includes('feedCardHeight = feedCardWidth * 1.25') && !appSource.includes('w kolejce'), 'Discover feed must fit a fixed native viewport without a banner, queue counter, or vertical scrolling.');
check(appSource.includes('interestCategoryGrid') && appSource.includes('interestOptionsGrid') && appSource.includes('getInterestIcon(item, activeCategory.icon)'), 'Interest selection must use the icon-based two-column grid.');
check(!appSource.includes('profil spoza Twojej bańki') && appSource.includes('interestMatchPercent'), 'Profile cards must show interest compatibility instead of exclusionary copy.');
check(appSource.includes('SPARKLIKE') && appSource.includes('Match po wzajemności') && appSource.includes('Napisz teraz') && appSource.includes('profile.interests.slice(0, 8)'), 'Full profile must expose release-ready actions and the compact interest grid.');
check(!appSource.includes('process.env.EXPO_OS') && appSource.includes('behavior={Platform.OS === "ios" ? "padding" : undefined}'), 'Native iOS behavior must use reliable Platform detection.');
check(appSource.includes('style={styles.discoveryDrawerScrollView}') && appSource.includes('contentContainerStyle={styles.discoveryDrawerScroll}'), 'Discovery drawer must remain scrollable on compact iPhones.');
check(appSource.includes('confirmRemovePhoto(index: number)') && appSource.includes('style={styles.photoRemoveButton}'), 'Profile photo removal controls are missing.');
check(appSource.includes('getProfileKey(profile) !== appUser?.uid'), 'Discovery feed must exclude the signed-in user.');
check(appSource.includes('LocationControl') && appSource.includes('Location.getForegroundPermissionsAsync()') && appSource.includes('updateCurrentLocation(true)'), 'Location permission must be contextual and user initiated.');
check(appSource.includes('openAdsPrivacyOptions'), 'In-app ad privacy settings entry is missing.');
check(appSource.includes('Subskrypcja odnawia si\\u0119 automatycznie') && appSource.includes('zakupem jednorazowym bez automatycznego odnawiania'), 'App Store subscription billing disclosure is missing.');
check(appSource.includes('__DEV__ && process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN'), 'Demo login must be development-only.');
check(appSource.includes('configuredTestProfileViewerEmails') && appSource.includes('(canViewTestProfiles || item.isTestProfile !== true)'), 'Test profiles must be restricted to configured tester accounts.');
check(firestoreSource.includes('await runTransaction(currentDb, async (transaction) =>') && firestoreSource.includes('if (existing.status === "matched") return;'), 'Match creation must remain transactional and idempotent.');
check(firestoreSource.includes('orderBy("updatedAt", "desc")') && firestoreSource.includes('startAfter(cursor)') && appSource.includes('profilesHaveMore'), 'Discovery pagination and freshness ordering are missing.');
check(appSource.includes('userIntent: intent') && appSource.includes('sameIntent') && appSource.includes('rotationScore'), 'Intent-aware daily matching rotation is missing.');
check(appSource.includes('includeProfilesWithoutLocation') && appSource.includes('Uwzględniaj profile bez lokalizacji'), 'Unknown-location discovery behavior must be explicit.');
check(appSource.includes('recentMessageTimesRef') && rulesSource.includes('data.createdAt == request.time'), 'Chat burst protection or trusted server timestamps are missing.');
check(publicProfileSync.includes('desiredAgeMin') && publicProfileSync.includes('desiredAgeMax'), 'Reciprocal age preferences must be published for matching.');
check(rulesSource.includes("hasLike(request.auth.uid, otherMember(resource.data))"), 'Mutual likes must be allowed to promote an existing chat request to a match.');
check(appSource.includes('isOwnProfile') && appSource.includes('WYRÓŻNIONE ZAINTERESOWANIA'), 'Profile-card preview and highlighted interests are missing.');
check(appSource.includes('sendingMessageKeysRef') && firestoreSource.includes('text.length > 2000'), 'Chat duplicate-send and message-length guards are missing.');

for (const [name, source] of Object.entries({ 'app.json': appJsonSource, 'App.tsx': appSource, 'src/auth.ts': authSource, 'src/firestore.ts': firestoreSource })) {
  check(!source.includes('\uFFFD'), `${name} contains a Unicode replacement character.`);
  check(!/[ÃÅÄ][^\s]/.test(source), `${name} contains likely UTF-8 mojibake.`);
  check(!/Nie uda\?o|Spr\?buj|zablokowac|Szukaj prosb/.test(source), `${name} contains broken Polish UI text.`);
}

const icon = fs.readFileSync(path.join(root, app.icon));
check(icon.toString('ascii', 1, 4) === 'PNG', 'App icon is not a PNG.');
check(icon.readUInt32BE(16) === 1024 && icon.readUInt32BE(20) === 1024, 'App icon must be 1024x1024.');
check(icon[25] === 2, 'App icon must be opaque RGB without an alpha channel.');
check(packageJson.dependencies?.['expo-apple-authentication'], 'Apple Authentication dependency is missing.');
check(packageJson.dependencies?.['expo-crypto'], 'Apple nonce dependency is missing.');
check(packageJson.dependencies?.['@react-native-google-signin/google-signin'], 'Google Sign-In dependency is missing.');
check(packageJson.dependencies?.['expo-build-properties'], 'Expo build properties dependency is missing.');
check(packageJson.dependencies?.['expo-notifications'] && app.plugins?.includes('expo-notifications'), 'Expo push notification native setup is missing.');
check(notificationsSource.includes('getExpoPushTokenAsync') && functionsSource.includes('notifyNewMatch') && functionsSource.includes('notifyNewMessage'), 'Match and message push notification flow is incomplete.');
check(firebaseJson.functions?.source === 'functions' && firebaseJson.functions?.runtime === 'nodejs22', 'Firebase notification functions are not wired for production.');
check(codemagicSource.includes('npm ci --prefix functions') && codemagicSource.includes('npm --prefix functions run build'), 'Codemagic must install and compile Firebase Functions separately.');
check(packageJson.dependencies?.['react-native-purchases'], 'RevenueCat dependency is missing.');
check(packageJson.dependencies?.['react-native-google-mobile-ads'], 'Google Mobile Ads dependency is missing.');

if (failures.length) {
  console.error(`Release audit failed (${failures.length}/${checks}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Release audit passed: ${checks} checks.`);
