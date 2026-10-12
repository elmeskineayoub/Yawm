import { startMockGoogle } from "./mock-google";

/** Starts the simulated Google service for the whole browser run. No real Google is contacted. */
export default async function globalSetup() {
  const server = await startMockGoogle();
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
