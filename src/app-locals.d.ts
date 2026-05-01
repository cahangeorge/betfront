/// <reference path="../.astro/types.d.ts" />

declare global {
  namespace App {
    interface Locals {
      user: { id: number; email: string; name: string | null } | null
      sessionId: string | null
    }
  }
}

export {}
