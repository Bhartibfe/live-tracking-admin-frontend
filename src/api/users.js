import http from "./http";

export async function fetchAllUsers() {
  const res = await http.get("/auth/users");
  return res.data.data || [];
}
