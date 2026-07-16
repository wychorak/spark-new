export const sparkOwnerEmail = "wychor234@gmail.com";

export function isSparkOwnerAccount(email: string | null | undefined, emailVerified = false) {
  return emailVerified && email?.trim().toLowerCase() === sparkOwnerEmail;
}
