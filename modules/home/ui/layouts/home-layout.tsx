import { SidebarProvider } from "@/components/ui/sidebar";
import { HomeSidebar } from "../components/home-sidebar";

interface HomeLayoutProps {
    children:React.ReactNode;
}

const HomeLayout = ({children}:HomeLayoutProps) => {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <HomeSidebar />
                <main className="flex-1 overflow-y-auto bg-gray-50/50">
                    {children}
                </main>
            </div>
        </SidebarProvider>
    )
}

export default HomeLayout;