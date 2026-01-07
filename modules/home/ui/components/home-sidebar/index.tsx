import { SignedIn } from "@clerk/nextjs"

import { Separator } from "@/components/ui/separator"
import { Sidebar, SidebarContent, SidebarHeader as SidebarHeaderUI } from "@/components/ui/sidebar"

import { SidebarHeader } from "./sidebar-header"
import { MainSection } from "./main-section"
// import { PersonalSection } from "./personal-section"
// import { SubscriptionsSection } from "./subscriptions-section"

export const HomeSidebar = () => {
  return (
    <Sidebar className="z-40 border-none" collapsible="icon">
      <SidebarHeaderUI>
        <SidebarHeader />
      </SidebarHeaderUI>
      <SidebarContent className="bg-background">
        <MainSection />
        <Separator />
        {/* <PersonalSection /> */}
        <SignedIn>
          <>
            <Separator />
            {/* <SubscriptionsSection /> */}
          </>
        </SignedIn>
      </SidebarContent>
    </Sidebar>
  )
}