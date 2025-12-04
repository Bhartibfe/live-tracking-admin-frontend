import http from "./http";

export async function fetchAllLocations() {
  const res = await http.get("/location/all");
  return res.data;
}
