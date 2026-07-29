import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  TRAINER_PRIVATE_QUERY_ROOTS,
  purgeTrainerPrivateQueries,
} from "../trainerPrivateCache";

describe("trainer private query cache", () => {
  it("clears active and inactive trainer-sensitive queries after a 403", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const activeKey = ["coaching-habits", "trainer", "client-1"];
    const inactiveKey = ["progress", "trainer", "client-1"];
    queryClient.setQueryData(activeKey, { private: "habit" });
    queryClient.setQueryData(inactiveKey, { private: "progress" });

    const observer = new QueryObserver(queryClient, {
      queryKey: activeKey,
      queryFn: vi.fn().mockRejectedValue({ response: { status: 403 } }),
      enabled: false,
    });
    const unsubscribe = observer.subscribe(() => {});

    await purgeTrainerPrivateQueries(queryClient);

    expect(queryClient.getQueryData(activeKey)).toBeUndefined();
    expect(queryClient.getQueryData(inactiveKey)).toBeUndefined();
    unsubscribe();
    queryClient.clear();
  });

  it("keeps the purge scope limited to known trainer-private roots", async () => {
    const queryClient = new QueryClient();
    const publicKey = ["blog", "latest"];
    queryClient.setQueryData(publicKey, { title: "public" });

    await purgeTrainerPrivateQueries(queryClient);

    expect(TRAINER_PRIVATE_QUERY_ROOTS).toContain("coaching-habits");
    expect(queryClient.getQueryData(publicKey)).toEqual({ title: "public" });
    queryClient.clear();
  });
});
