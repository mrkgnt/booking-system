/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type StaffSession = { accessToken: string; user: { id: string; email: string } };

declare namespace App {
  interface Locals {
    session: StaffSession | null;
  }
}
