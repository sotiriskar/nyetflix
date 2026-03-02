'use client';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <main className="max-w-4xl mx-auto pt-24 pb-10 px-6 md:pt-28 md:px-10 md:pb-10">
        {children}
      </main>
    </div>
  );
}
