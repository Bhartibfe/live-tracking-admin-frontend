import http from "./http";

export async function fetchChargingPoints() {
  const res = await http.get("/charging/all");
  return res.data;
}
