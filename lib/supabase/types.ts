export type UserType = "regular";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  type: UserType;
};

export type AppSession = {
  user: AuthenticatedUser;
};
