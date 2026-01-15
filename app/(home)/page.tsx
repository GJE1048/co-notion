interface PageProps {
    searchParams: Promise<{
      categoryId?: string;
    }>
  };
  
  const Page = async ({  }: PageProps) => {
 
    return (
      <div>HOMEPAGE</div>
    );
  };
  
  export default Page;