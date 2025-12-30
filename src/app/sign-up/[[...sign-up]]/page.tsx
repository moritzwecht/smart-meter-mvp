import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight mb-1">ArmbrustTracker</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase text-[10px]">Smart Meter Management</p>
          </div>
        </div>

        <div className="glass rounded-[3rem] p-4 sm:p-6 overflow-hidden relative">
          <style dangerouslySetInnerHTML={{
            __html: `
            .cl-rootBox { width: 100%; }
            .cl-card { background: transparent !important; box-shadow: none !important; border: none !important; width: 100% !important; padding: 0 !important; }
            .cl-headerTitle, .cl-headerSubtitle, .cl-footer, .cl-footerAction { display: none !important; }
            .cl-socialButtonsBlockButton { 
              background: rgba(255, 255, 255, 0.05) !important; 
              border: 1px solid rgba(255, 255, 255, 0.1) !important; 
              border-radius: 1.25rem !important;
              padding: 1.25rem !important;
              transition: all 0.2s ease !important;
            }
            .cl-socialButtonsBlockButton:hover { 
              background: rgba(255, 255, 255, 0.1) !important; 
              transform: translateY(-2px);
            }
            .cl-socialButtonsBlockButtonText {
              font-weight: 800 !important;
              font-size: 0.875rem !important;
              color: inherit !important;
            }
            .cl-formButtonPrimary {
              background: #3b82f6 !important;
              border-radius: 1.25rem !important;
              padding: 1.25rem !important;
              font-weight: 800 !important;
              text-transform: none !important;
              font-size: 1rem !important;
              box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4) !important;
              margin-top: 1rem !important;
              color: white !important;
            }
            .cl-formFieldInput {
              background: rgba(0, 0, 0, 0.03) !important;
              border: 1px solid rgba(0, 0, 0, 0.05) !important;
              border-radius: 1rem !important;
              padding: 1rem !important;
              color: inherit !important;
            }
            .dark .cl-formFieldInput {
              background: rgba(255, 255, 255, 0.03) !important;
              border: 1px solid rgba(255, 255, 255, 0.05) !important;
            }
            .cl-formFieldLabel {
              text-transform: uppercase !important;
              letter-spacing: 0.1em !important;
              font-size: 0.65rem !important;
              font-weight: 800 !important;
              color: #94a3b8 !important;
              margin-bottom: 0.5rem !important;
              margin-left: 0.5rem !important;
            }
            .cl-identityPreviewText { 
              font-weight: 700 !important; 
              color: inherit !important;
            }
            .cl-identityPreviewEditButton { 
              color: #3b82f6 !important; 
              font-weight: 700 !important; 
            }
          `}} />
          <SignUp
            appearance={{
              elements: {
                rootBox: "cl-rootBox",
                card: "cl-card",
                headerTitle: "cl-headerTitle",
                headerSubtitle: "cl-headerSubtitle",
                socialButtonsBlockButton: "cl-socialButtonsBlockButton",
                socialButtonsBlockButtonText: "cl-socialButtonsBlockButtonText",
                formButtonPrimary: "cl-formButtonPrimary",
                formFieldInput: "cl-formFieldInput",
                formFieldLabel: "cl-formFieldLabel",
                footer: "cl-footer",
                footerAction: "cl-footerAction",
                identityPreviewText: "cl-identityPreviewText",
                identityPreviewEditButton: "cl-identityPreviewEditButton",
              }
            }}
          />
        </div>

        <p className="mt-8 text-center text-slate-400 dark:text-slate-600 text-xs font-medium">
          Sicher & verschlüsselt durch Clerk
        </p>
      </div>
    </div>
  );
}
