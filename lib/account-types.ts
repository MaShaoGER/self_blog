export type AccountRole = "admin" | "editor";

export interface PublicAccount {
  id: string;
  username: string;
  displayName: string;
  role: AccountRole;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  username: string;
  displayName: string;
  password: string;
  role: AccountRole;
}

export interface UpdateAccountInput {
  displayName?: string;
  role?: AccountRole;
  enabled?: boolean;
}
