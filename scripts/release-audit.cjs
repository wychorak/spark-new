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
const eventsSource = read('src/events.ts');
const firebaseSource = read('src/firebase.ts');
const googleSource = read('src/google-sign-in.ts');
const googlePlistSource = read('GoogleService-Info.plist');
const revenueCatSource = read('src/revenuecat.ts');
const adsSource = read('src/ads.tsx');
const storeReviewSource = read('src/store-review.ts');
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
check(firebaseSource.includes('firebaseProjectMatches') && firebaseSource.includes('projectMismatch: !firebaseProjectMatches'), 'Runtime Firebase config must reject accidental non-Spark project overrides.');
check(firebaseSource.includes('getFunctions(firebaseApp, "europe-west1")'), 'Firebase callable functions must use the deployed europe-west1 region.');
check(googleSource.includes('defaultGoogleClientIds') && googleSource.includes('.apps.googleusercontent.com'), 'Production Google client ID fallback is missing.');
check(googlePlistSource.includes('com.googleusercontent.apps.271339297035-320oq6h9pcmdn5kk75k5fg8igo9ht0h0') && googleSource.includes('271339297035-320oq6h9pcmdn5kk75k5fg8igo9ht0h0.apps.googleusercontent.com'), 'Google iOS redirect scheme and client ID are inconsistent.');
check(revenueCatSource.includes('__DEV__ ? "test_') && revenueCatSource.includes('!apiKey.startsWith("test_")'), 'RevenueCat simulated key guard is missing.');
check(adsSource.includes('showPrivacyOptionsForm') && adsSource.includes('requestNonPersonalizedAdsOnly: true'), 'Ad consent/privacy protections are incomplete.');
check(rulesSource.includes('hasRevenueCatPro()') && rulesSource.includes('validPremiumUsageUpdate()'), 'Premium Firestore protections are missing.');
check(rulesSource.includes('activeEntitlements') && !rulesSource.includes('revenueCatEntitlements'), 'RevenueCat Firebase claim name must be activeEntitlements.');
check(rulesSource.includes('allowedUserText') && appSource.includes('findModerationViolation'), 'UGC text filtering is missing.');
check(appSource.includes('onReportProfile(description)') && appSource.includes('targetProfile: targetProfile ?'), 'In-app reporting must preserve the user reason and profile context.');
check(appSource.indexOf('requestAccountDeletionAndDeleteProfile') < appSource.indexOf('deleteProfilePhotos(appUser.uid, profilePhotos)'), 'Account deletion request must not be blocked by photo cleanup.');
check(functionsSource.includes('createPremiumChatRequest = onCall') && functionsSource.includes('maxPremiumRequestsPerDay = 10') && functionsSource.includes('hasVerifiedPro') && firestoreSource.includes('"createPremiumChatRequest"'), 'Premium chat requests must use the verified server-side callable and daily limit.');
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
check(appSource.includes('scrollEnabled={tab !== "discover"}') && appSource.includes('tab === "matches"') && !appSource.includes('(tab === "matches" || tab === "messages")') && appSource.includes('<SparkAdBanner enabled={showCurrentBanner}') && appSource.includes('feedCardHeight = feedCardWidth * 1.25') && !appSource.includes('w kolejce'), 'Discover feed must fit a fixed native viewport without a banner, queue counter, or vertical scrolling; active chat must remain ad-free.');
check(appSource.includes('interestCategoryGrid') && appSource.includes('interestOptionsGrid') && appSource.includes('getInterestIcon(item, activeCategory.icon)'), 'Interest selection must use the icon-based two-column grid.');
check(!appSource.includes('profil spoza Twojej bańki') && appSource.includes('interestMatchPercent'), 'Profile cards must show interest compatibility instead of exclusionary copy.');
check(appSource.includes('relationshipStatus') && appSource.includes('onSuperlike') && appSource.includes('visibleInterests = profile.interests.slice(0, 8)'), 'Full profile must expose release-ready actions and the compact interest grid.');
check(adsSource.includes('export const SWIPES_PER_INTERSTITIAL = 10') && appSource.includes('adsReady && tab === "discover"'), 'Swipe interstitial must run only on discovery after exactly ten decisions.');
check(adsSource.includes('AdEventType.PAID') && adsSource.includes('trackAdRevenue') && adsSource.includes('toRevenueMicros'), 'Interstitial and banner impression revenue must be reported in RevenueCat micros.');
const chatModalSource = appSource.slice(appSource.indexOf('function ChatConversationModal'), appSource.indexOf('function PremiumScreen'));
check(appSource.includes('placement="messages-list"') && appSource.includes('visibleConversations.length >= 2') && adsSource.includes('EXPO_PUBLIC_ADMOB_IOS_CHAT_BANNER_ID') && !chatModalSource.includes('SparkAdBanner'), 'Chat-list monetization must be limited to a reserved Free-user slot outside the active conversation.');
check(revenueCatSource.includes('trackCustomPaywallImpression') && appSource.includes('trackPaywallView(entrySource)'), 'Custom Spark Pro paywall impressions must be attributed to their entry source.');
check(packageJson.dependencies?.['expo-store-review'] && storeReviewSource.includes('MATCHES_BEFORE_REVIEW = 2') && appSource.includes('registerPositiveMatchForReview'), 'Native review prompt must be tied to a positive match milestone.');
check(!appSource.includes('Profil prywatny') && !appSource.includes('isPrivateProfile') && !publicProfileSync.includes('profile.privateProfile !== true'), 'Private-profile mode must not hide release profiles.');
check(appSource.includes('SocialHandleField') && appSource.includes('normalizeSocialHandle') && appSource.includes('formatSocialHandle') && firestoreSource.includes('sanitizePublicSocials'), 'Social usernames must be sanitized, persisted, and rendered without URLs.');
check(rulesSource.includes("data.socials.keys().hasOnly(['Instagram', 'TikTok', 'Facebook'])"), 'Public social usernames need a strict Firestore allowlist.');
check(appSource.includes('style={styles.signOutButton}') && appSource.includes('onSignOut={confirmSignOut}'), 'A visible profile sign-out action is missing.');
check(appSource.includes('visibilityBoostScore = params.profile.premium ? 4 : 0'), 'Spark Pro visibility boost is not applied to matching.');
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
check(appSource.includes('userIntents: intents') && appSource.includes('sharedIntentCount') && appSource.includes('recommendationTier') && appSource.includes('targetIntents') && appSource.includes('rotationScore') && appSource.includes('sameCity') && firestoreSource.includes('const pageSize = 24'), 'Tiered multi-intent discovery ranking, local fallback, or bounded pagination is missing.');
check(appSource.includes('includeProfilesWithoutLocation') && appSource.includes('Uwzględniaj profile bez lokalizacji'), 'Unknown-location discovery behavior must be explicit.');
check(functionsSource.includes('sendChatMessage = onCall') && functionsSource.includes('maxMessagesPerMinute = 20') && functionsSource.includes('minMessageIntervalMs = 700') && firestoreSource.includes('"sendChatMessage"') && rulesSource.includes('allow create: if false;'), 'Chat must use trusted server timestamps and server-side burst limits.');
check(publicProfileSync.includes('desiredAgeMin') && publicProfileSync.includes('desiredAgeMax'), 'Reciprocal age preferences must be published for matching.');
check(rulesSource.includes("hasLike(request.auth.uid, otherMember(resource.data))"), 'Mutual likes must be allowed to promote an existing chat request to a match.');
check(appSource.includes('isOwnProfile') && appSource.includes('WYRÓŻNIONE ZAINTERESOWANIA'), 'Profile-card preview and highlighted interests are missing.');
check(appSource.includes('sendingMessageKeysRef') && firestoreSource.includes('text.length > 2000'), 'Chat duplicate-send and message-length guards are missing.');
check(appSource.includes('captureRef(cardRef') && appSource.includes('ShareProfileCardModal') && appSource.includes('appInstallUrl'), 'Shareable privacy-safe profile card is missing.');
check(appSource.includes('Dołącz ze mną') && appSource.includes('source={brandLogoImage}') && !appSource.includes('NOWA ISKRA JEST BLIŻEJ NIŻ MYŚLISZ') && !appSource.includes('Karta zawiera tylko pierwsze imię'), 'Share card must keep the simplified single-logo mobile design.');
check(appSource.includes('buildConversationStarters') && appSource.includes('conversationStarters.map') && appSource.includes('viewerInterests={selectedInterests}'), 'Personalized first-message starters are missing.');
check(appSource.includes('GenderPreferencesEditor') && appSource.includes('genderPreferenceMatches') && firestoreSource.includes('desiredGendersByIntent') && rulesSource.includes('validGenderPreferences'), 'Per-intent gender preferences must be persisted and enforced in discovery.');
check(firestoreSource.includes('observeChatMessages') && firestoreSource.includes('lastMessageText') && appSource.includes('optimisticMessage'), 'Chat must subscribe only to the active history and render optimistic sends.');
check(firestoreSource.includes('profileViewWriteCooldownMs = 10 * 60 * 1000') && appSource.includes('tab !== \"profile\"'), 'Profile-view writes and the Pro viewer listener must be cost-bounded.');
check(firestoreSource.includes('outgoingSwipeCacheTtlMs = 60 * 1000') && firestoreSource.includes('invalidateOutgoingSwipeCache'), 'Repeated feed refreshes must reuse bounded swipe history and invalidate it after mutations.');
check(firestoreSource.includes('getPublicProfiles') && firestoreSource.includes('where(documentId(), \"in\", batch)') && appSource.includes('getPublicProfiles(conversationProfileKeys)'), 'Related public profiles must be fetched in batched requests.');
check(appSource.includes('canViewTestProfiles ? findMatchThreadsForUser') && appSource.includes('tab !== \"matches\"'), 'Duplicate relation and incoming-like reads must stay lazy outside tester and Matches flows.');
check(appSource.includes('pendingMessageDraft') && appSource.includes('onPendingMessageDraftConsumed') && appSource.includes('Promise<boolean>'), 'Chat typing state must stay isolated from the root discovery renderer.');
check(appSource.includes('shareSparkInvite') && appSource.includes('Zaproś znajomych'), 'Install-link invitation flow is missing.');
check(eventsSource.includes('isEventActive') && eventsSource.includes('sanitizeActiveEvents') && eventsSource.includes('getSharedActiveEvents'), 'Event Friends expiry or shared-event filtering is missing.');
check(eventsSource.includes('startsAt: string') && eventsSource.includes('endsAt: string') && !/latitude|longitude|street|address/i.test(eventsSource), 'Event Friends must use concrete time ranges without precise locations.');
check(firestoreSource.includes('findProfilesByActiveEvents') && firestoreSource.includes('activeEventIds') && firestoreSource.includes('eventContext'), 'Event Friends Firestore query or match context is incomplete.');
check(rulesSource.includes('validEventList') && rulesSource.includes('isEventAdmin') && rulesSource.includes('match /sparkEvents/{eventId}'), 'Curated Event Friends catalog authorization is incomplete.');
check(functionsSource.includes('cleanupExpiredSparkEvents') && functionsSource.includes('every 15 minutes') && functionsSource.includes('cleanupDeletedSparkEvent'), 'Expired Event Friends cleanup is missing.');
check(appSource.includes('EventFriendsManagerModal') && appSource.includes('EventFriendsEmptyState') && appSource.includes('discoverMode === "events"'), 'Separate Event Friends discovery flow is missing.');
check(appSource.includes('sparkEventAdminEmail') && appSource.includes('PANEL ORGANIZATORA') && !appSource.includes('buildSuggestedEvents'), 'Event creation must stay restricted to the Spark organizer account.');
check(eventsSource.includes('eventIconOptions') && appSource.includes('Ikona wydarzenia') && rulesSource.includes("'microphone-variant'"), 'Curated thematic event icons are missing.');
check(appSource.includes('WSPÓLNY PLAN') && appSource.includes('Uczestniczę') && appSource.includes('Razem na') && appSource.includes('calendar-heart'), 'Shared and temporary event participation context is missing from profile and chat UI.');

check(revenueCatSource.includes('!hasSparknewPro(result.customerInfo)') && revenueCatSource.includes('completed && hasSparknewPro(refreshedInfo)'), 'RevenueCat purchases must verify the active Spark Pro entitlement before unlocking access.');
check(appSource.includes('ownerProAccess') && rulesSource.includes('function isSparkOwner()') && firestoreSource.includes('isSparkOwnerAccount'), 'Verified Spark owner Pro access must stay consistent across UI and Firestore.');
check(firestoreSource.includes('recordCurrentUserProfileView') && firestoreSource.includes('observeRecentProfileViews') && rulesSource.includes('match /profileViews/{viewerUid}'), 'Private Spark Pro profile-view tracking is incomplete.');
check(rulesSource.includes("duration.value(10, 'm')") && rulesSource.includes('allow read, delete: if isOwner(uid) && hasRevenueCatPro()'), 'Profile views must be rate-limited and private to their Pro owner.');
check(appSource.includes('ProfileViewerPanel') && appSource.includes('Kto oglądał Twój profil'), 'Spark Pro profile viewers UI is missing.');
check(authSource.includes('uid: user.uid') && revenueCatSource.includes('Purchases.logIn(appUserId)'), 'Firebase UID must be the canonical RevenueCat customer identity.');
check(firestoreSource.includes('function requireCurrentUserUid') && firestoreSource.includes('requireCurrentUserUid(profile.uid)') && rulesSource.includes('request.resource.data.uid == uid'), 'User profile writes must enforce the authenticated Firebase UID.');
check(appSource.includes('id: \"bundled-test-aisha\"') && appSource.includes('return profile.id;'), 'Every real and bundled test profile must have a stable unique ID.');

for (const [name, source] of Object.entries({ 'app.json': appJsonSource, 'App.tsx': appSource, 'src/auth.ts': authSource, 'src/firestore.ts': firestoreSource, 'src/events.ts': eventsSource, 'functions/src/index.ts': functionsSource })) {
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
check(functionsSource.includes('notifyNewSparkEvent') && functionsSource.includes('collectionGroup("devices")') && functionsSource.includes('route: "eventFriends"') && notificationsSource.includes('"eventFriends"') && appSource.includes('setEventManagerOpen(true)'), 'New Event Friends publications must notify all registered devices and deep-link to the event catalog.');
check(functionsSource.includes('markChatThreadRead = onCall') && functionsSource.includes('unreadCountByUid') && firestoreSource.includes('markChatThreadRead') && appSource.includes('messageAttentionCount'), 'Server-authoritative unread chat counters are incomplete.');
check(notificationsSource.includes('setBadgeCountAsync') && notificationsSource.includes('threadId') && appSource.includes('pendingNotificationThreadId'), 'Chat notifications must update the app badge and deep-link to the exact thread.');
check(rulesSource.includes("'unreadCountByUid'") && rulesSource.includes("request.resource.data.get('unreadCountByUid', null) == null") && rulesSource.includes("request.resource.data.get('unreadCountByUid', null) == resource.data.get('unreadCountByUid', null)"), 'Clients must not be able to forge unread chat counters.');
check(functionsSource.includes('resetPassedProfiles = onCall') && functionsSource.includes('.where("status", "==", "passed")') && firestoreSource.includes('"resetPassedProfiles"') && appSource.includes('await resetPassedProfiles()'), 'Restoring skipped profiles must delete persisted pass swipes before reloading discovery.');
check(functionsSource.includes('updateActiveEvents = onCall') && functionsSource.includes('transaction.update(publicProfileRef') && firestoreSource.includes('"updateActiveEvents"'), 'Event Friends selection must be validated and saved atomically by the server.');
check(appSource.includes('function BlockedProfilesModal') && firestoreSource.includes('export async function unblockUser') && appSource.includes('blockedProfileKeys={blockedProfileKeys}'), 'Blocked profiles must be reviewable, reportable, and removable from Safety Center.');
check(appSource.includes('profileReturnChatKey') && appSource.includes('setSelectedChatKey(null)') && appSource.includes('messageAvatarSpacer'), 'Chat profile navigation and grouped message avatars are incomplete.');
check(functionsSource.includes('cancelProfileLike = onCall') && functionsSource.includes('.where("fromUid", "==", uid)') && firestoreSource.includes('"cancelProfileLike"'), 'Pending likes must be cancelled server-side across legacy swipe IDs.');
check(functionsSource.includes('sendSparkLike = onCall') && functionsSource.includes('superlikesRemaining') && functionsSource.includes('transaction.create(matchRef') && firestoreSource.includes('"sendSparkLike"'), 'SparkLike must be server-authoritative, limited, and create a match atomically.');
check(firebaseJson.functions?.source === 'functions' && firebaseJson.functions?.runtime === 'nodejs22', 'Firebase notification functions are not wired for production.');
check(codemagicSource.includes('npm ci --prefix functions') && codemagicSource.includes('npm --prefix functions run build'), 'Codemagic must install and compile Firebase Functions separately.');
check(packageJson.dependencies?.['react-native-purchases'], 'RevenueCat dependency is missing.');
check(packageJson.dependencies?.['react-native-google-mobile-ads'], 'Google Mobile Ads dependency is missing.');
check(packageJson.dependencies?.['expo-sharing'] && packageJson.dependencies?.['react-native-view-shot'], 'Native profile-card sharing dependencies are missing.');
check(appConfigSource.includes('expo-sharing'), 'Expo sharing plugin is not enabled in dynamic config.');

if (failures.length) {
  console.error(`Release audit failed (${failures.length}/${checks}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Release audit passed: ${checks} checks.`);
