export const StickerMapRoles = {
  VIEWER: 'sm-viewer',
  UPLOADER: 'sm-uploader',
  EDITOR: 'sm-editor',
  ADMIN: 'sm-admin',
} as const;

export interface KeycloakUserInfo {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}
