"use client";

import { UserButton, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export const AuthButton = () => {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="outline" size="sm">
            登录
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
          afterSignOutUrl="/"
        />
      </SignedIn>
    </>
  );
};
