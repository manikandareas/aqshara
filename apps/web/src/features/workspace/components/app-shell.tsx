import * as React from "react"
import { Show, UserButton } from "@clerk/tanstack-react-start"

export function AppShell() {
  const [activeTab, setActiveTab] = React.useState<string | null>(null)

  return (
    <div className="dark flex h-screen w-full bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
      {/* Sidebar - using --sidebar token via Tailwind classes */}
      <aside className="w-[260px] shrink-0 bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col justify-between h-full">
        {/* Top Section */}
        <div className="flex flex-col gap-1 p-3">
          {/* User Profile Selector */}
          <div className="flex items-center justify-between w-full px-2 py-2 mb-4 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors group">
            <Show when="signed-in">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 overflow-hidden">
                  <UserButton />
                  <span className="text-sm font-medium truncate opacity-90 group-hover:opacity-100 hidden sm:block">My Account</span>
                </div>
                <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100">
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-[-4px]">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <ChevronsLeftIcon className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Show>
            <Show when="signed-out">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 border border-primary/30">
                  <img src="/logo.svg" alt="Avatar" className="w-4 h-4 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <span className="absolute">?</span>
                </div>
                <span className="text-sm font-medium truncate opacity-90 group-hover:opacity-100">Sign In</span>
              </div>
            </Show>
          </div>

          {/* Navigation Items */}
          <div className="space-y-[2px]">
            <NavItem icon={<PlusIcon filled />} label="New" />
            <NavItem
              icon={<DocumentIcon />}
              label="Documents"
              active={activeTab === "documents"}
              onClick={() => setActiveTab(activeTab === "documents" ? null : "documents")}
            />
            <NavItem
              icon={<LibraryIcon />}
              label="Library"
              active={activeTab === "library"}
              onClick={() => setActiveTab(activeTab === "library" ? null : "library")}
            />
            <NavItem
              icon={<SparklesIcon />}
              label="AI Chat"
              active={activeTab === "ai-chat"}
              onClick={() => setActiveTab(activeTab === "ai-chat" ? null : "ai-chat")}
            />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-[2px] p-3">
          <NavItem icon={<VideoIcon />} label="Tutorials" />
          <NavItem icon={<HelpIcon />} label="Help" />
          <NavItem icon={<CommandIcon />} label="Shortcuts" />

          <button className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg py-2 px-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-[0.98]">
            <ZapIcon className="w-3.5 h-3.5 fill-current" />
            See Pricing
          </button>
        </div>
      </aside>

      {/* Secondary Sidebar Context Area */}
      <aside
        className={`shrink-0 bg-sidebar overflow-hidden transition-all duration-150 ease-out border-r ${activeTab === "documents"
            ? "w-[300px] border-sidebar-border opacity-100"
            : "w-0 border-transparent opacity-0"
          }`}
      >
        <div className="w-[300px] h-full flex flex-col text-sidebar-foreground">
          {/* Top Area */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3">
            <span className="font-semibold text-[15px] tracking-tight">Documents</span>
            <div className="flex items-center gap-3 text-sidebar-foreground/60">
              <button className="w-7 h-7 rounded-md bg-primary/80 text-primary-foreground flex items-center justify-center hover:bg-primary transition-colors shadow-sm">
                <PlusIconSimple className="w-4 h-4" />
              </button>
              <button onClick={() => setActiveTab(null)} className="w-7 h-7 flex items-center justify-center hover:text-sidebar-foreground transition-colors group">
                <ChevronsLeftIcon className="w-4 h-4 opacity-70 group-hover:opacity-100" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-3 pb-4">
            <div className="relative flex items-center w-full">
              <SearchIcon className="absolute left-3 w-3.5 h-3.5 text-sidebar-foreground/40" />
              <input
                type="text"
                placeholder="Search docs..."
                className="w-full bg-background/50 border border-sidebar-border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40 shadow-sm transition-shadow"
              />
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto w-full px-2 space-y-1 pb-4">
            <div className="w-full text-left px-3 py-2.5 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors cursor-pointer group flex flex-col gap-1.5 border border-sidebar-border/50">
              <span className="text-sm font-medium text-sidebar-foreground truncate w-full">Generative AI-Based Digital Course Applica...</span>
              <span className="text-[11px] text-sidebar-foreground/50 font-medium">9 March &middot; Opened 1 seconds ago</span>
            </div>

            <div className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer group flex flex-col gap-1.5 border border-transparent">
              <span className="text-sm font-medium text-sidebar-foreground truncate w-full opacity-90">Untitled</span>
              <span className="text-[11px] text-sidebar-foreground/50 font-medium">24 March &middot; Opened 6 seconds ago</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-background">
        {/* Top Navigation / Action Bar */}
        <header className="absolute top-0 right-0 w-full flex items-center justify-between px-4 py-3 z-10">
          <div className="flex-1 flex items-center px-4">
            <span className="text-xs font-medium text-foreground/40 hidden sm:block">Untitled</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-sidebar/50 rounded-lg transition-colors">
              <UserPlusIcon />
              Share
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-sidebar/50 rounded-lg transition-colors">
              <ShieldCheckIcon />
              Review
            </button>
            <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border border-transparent shadow-md shadow-primary/30 rounded-full px-3 py-1.5 text-sm font-medium transition-all">
              <ZapIcon className="w-3.5 h-3.5 fill-current" />
              See Pricing
            </button>
            <button className="flex items-center justify-center w-8 h-8 text-foreground/60 hover:text-foreground hover:bg-sidebar/50 rounded-lg transition-colors ml-1">
              <MoreHorizontalIcon />
            </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="flex-1 overflow-auto pt-32 pb-40 px-10 md:px-20 lg:px-40 flex justify-center">
          <div className="w-full max-w-3xl">
            <div className="flex items-center">
              <h1 className="text-[2.5rem] leading-tight font-semibold text-foreground/80 tracking-tight">
                Untitled
              </h1>
              <div className="w-[1.5px] h-10 bg-primary ml-1 animate-[pulse_1s_infinite]" />
            </div>
            {/* Minimal content area body could go here */}
          </div>
        </div>

        {/* Bottom Status / Word count */}
        <div className="absolute bottom-6 right-8 text-xs font-medium text-foreground/40">
          0 words
        </div>

        {/* Floating Toolbar Pill */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center bg-sidebar/90 backdrop-blur-xl border border-border shadow-2xl rounded-full px-2 py-1.5 h-12">

          <div className="flex items-center gap-1.5 px-3">
            <div className="w-7 h-4 rounded-full bg-primary relative flex items-center cursor-pointer">
              <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 shadow-sm" />
            </div>
            <span className="text-xs font-medium text-white/90">Autocomplete</span>
            <ChevronUpIcon className="w-3 h-3 text-white/50 ml-1" />
          </div>

          <div className="w-px h-5 bg-white/8 mx-1" />

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/6 transition-colors text-white/90 group">
            <span className="text-[13px] font-medium opacity-80 group-hover:opacity-100 flex items-center justify-center">
              <span className="opacity-60 mr-1.5 font-sans">@</span> Cite
            </span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/6 transition-colors text-white/90 group">
            <span className="flex items-center gap-1.5 text-[13px] font-medium opacity-80 group-hover:opacity-100">
              <TextIcon /> Text
            </span>
          </button>

          <div className="w-px h-5 bg-white/8 mx-1" />

          <div className="flex items-center px-1">
            <ToolbarIconButton icon={<ArrowsUpDownIcon />} />
            <ToolbarIconButton icon={<ImageIcon />} />
            <ToolbarIconButton icon={<ListIcon />} />
            <ToolbarIconButton icon={<FunctionIcon />} />
            <ToolbarIconButton icon={<MathIcon />} />
          </div>

          <div className="w-px h-5 bg-white/8 mx-1" />

          <div className="flex items-center px-1">
            <ToolbarIconButton icon={<UndoIcon />} />
            <ToolbarIconButton icon={<RedoIcon />} />
          </div>

        </div>
      </main>

      {/* AI Chat Sidebar (Right) */}
      <aside
        className={`shrink-0 bg-sidebar overflow-hidden transition-all duration-150 ease-out border-l flex flex-col ${activeTab === "ai-chat"
            ? "w-[380px] border-sidebar-border opacity-100"
            : "w-0 border-transparent opacity-0"
          }`}
      >
        <div className="w-[380px] h-full flex flex-col text-sidebar-foreground">
          {/* Top Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setActiveTab(null)} className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors group">
                <ChevronsRightIcon className="w-4 h-4 opacity-70 group-hover:opacity-100" />
              </button>
              <span className="font-semibold text-[15px] tracking-tight">AI Chat</span>
            </div>
            <div className="flex items-center gap-2 text-sidebar-foreground/60">
              <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                <ClockIcon className="w-[18px] h-[18px]" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-[#5b5fd6]/20 text-[#7a7ef4] flex items-center justify-center hover:bg-[#5b5fd6]/30 transition-colors ml-1">
                <EditIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col justify-end items-center pb-8">
            {/* Center Reference Chip (from image) */}
            <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/5 border border-white/5 text-[13px] font-medium text-sidebar-foreground/80 shadow-sm backdrop-blur-sm">
              3.2 Data Collection and Analysis
            </div>
          </div>

          {/* Bottom Chat Input */}
          <div className="p-4 pt-2">
            <div className="flex items-center gap-2 mb-3">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/10 hover:bg-sidebar-accent/50 text-[13px] font-medium text-sidebar-foreground/80 transition-colors">
                <PlusIconSimple className="w-3.5 h-3.5" />
                Add...
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/30 text-[13px] font-medium text-sidebar-foreground/90">
                <DocumentTextIcon className="w-3.5 h-3.5 opacity-70" />
                Current document
                <CloseIcon className="w-3.5 h-3.5 ml-1 opacity-50 hover:opacity-100 cursor-pointer" />
              </div>
            </div>

            <div className="relative bg-background/50 border border-sidebar-border rounded-2xl p-3 focus-within:ring-1 focus-within:ring-[#5b5fd6]/50 focus-within:border-[#5b5fd6]/50 transition-all shadow-sm">
              <textarea
                placeholder="Ask AI, use @ to mention specific PDFs or / to access saved prompts"
                className="w-full bg-transparent resize-none text-[13.5px] focus:outline-none min-h-[50px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-sidebar-accent text-sidebar-foreground/80 transition-colors bg-white/10 shadow-sm font-bold text-xs border border-white/5 mr-1">
                    /
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                    <LinkIcon className="w-[18px] h-[18px]" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                    <ImageIconOutline className="w-[18px] h-[18px]" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors mr-1">
                    <SettingsSlidersIcon className="w-[18px] h-[18px]" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-full bg-[#5b5fd6] text-white hover:bg-[#4f53cd] transition-colors shadow-sm">
                    <ArrowUpIcon className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

// ----- Components & Icons -----

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
        ? "bg-sidebar-accent/50 text-foreground"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
      }`}>
      {icon}
      {label}
    </button>
  )
}

function ToolbarIconButton({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/60 hover:text-white transition-colors">
      {icon}
    </button>
  )
}

// --- Icons --- 
const PlusIcon = ({ filled }: { filled?: boolean }) => (
  filled ? (
    <div className="size-[20px] rounded-full bg-primary flex justify-center items-center text-primary-foreground shrink-0 shadow-sm border border-primary/40">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
    </div>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
  )
)

const DocumentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
)

const LibraryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
)

const SparklesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
)

const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
)

const HelpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
)

const CommandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" /></svg>
)

const ZapIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`opacity-90 ${className || ''}`}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
)

const UserPlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
)

const ShieldCheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
)

const MoreHorizontalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
)

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="18 15 12 9 6 15" /></svg>
)

const TextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
)

const ArrowsUpDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11" /><polyline points="17 13 12 18 7 13" /></svg>
)

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
)

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
)

const FunctionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
)

const MathIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5h-2l-2 14H6M4 5h2" /></svg>
)

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>
)

const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
)

const ChevronsLeftIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
)

const PlusIconSimple = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
)

const ChevronsRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
)

const ClockIcon = ({ className }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
)

const EditIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
)

const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
)

const CloseIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
)

const LinkIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
)

const ImageIconOutline = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
)

const SettingsSlidersIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
)

const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
)
