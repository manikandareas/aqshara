export type SessionUser = {
  id: string;
  email: string;
};

export function getAuthHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}
