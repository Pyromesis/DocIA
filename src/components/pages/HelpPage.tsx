
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen,
    Heart,
    Bug,
    ExternalLink,
    Check,
    Image as ImageIcon,
    Send,
    LifeBuoy,
    Copy
} from "lucide-react";

export function HelpPage() {
    const [activeTab, setActiveTab] = useState<'tutorial' | 'donate' | 'report'>('tutorial');
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [bugForm, setBugForm] = useState({ description: "", contact: "" });
    const [bugImage, setBugImage] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedAddress(label);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const handleBugSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Use FormData for multipart upload so screenshots are sent as attachments
            const formData = new FormData();
            formData.append('subject', 'New Bug Report - DocIA');
            formData.append('message', bugForm.description);
            formData.append('contact', bugForm.contact || 'Anonymous');
            formData.append('_captcha', 'false');

            // Attach screenshot if provided
            if (bugImage) {
                formData.append('attachment', bugImage, bugImage.name);
            }

            await fetch("https://formsubmit.co/ajax/dociaofficial@outlook.com", {
                method: "POST",
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            });

            setSubmitStatus('success');
        } catch (error) {
            console.error("Failed to send report:", error);
            setSubmitStatus('success');
        } finally {
            setIsSubmitting(false);

            // Reset after delay
            setTimeout(() => {
                setSubmitStatus('idle');
                setBugForm({ description: "", contact: "" });
                setBugImage(null);
            }, 5000);
        }
    };

    const TABS = [
        { id: 'tutorial', label: 'Tutorial & API', icon: BookOpen },
        { id: 'donate', label: 'Donate', icon: Heart },
        { id: 'report', label: 'Report Bug', icon: Bug },
    ] as const;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                        <LifeBuoy className="w-6 h-6 text-[#B8925C]" />
                        Help & Community
                    </h2>
                    <p className="text-sm text-stone-500 mt-1">Guides, support, and feedback</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-stone-200/60 pb-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 relative ${activeTab === tab.id
                            ? "text-[#7C5C3F] bg-stone-50 border-b-2 border-[#B8925C]"
                            : "text-stone-500 hover:text-stone-700 hover:bg-stone-50/50"
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeHelpTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B8925C]"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm min-h-[500px] p-6 md:p-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'tutorial' && (
                        <motion.div
                            key="tutorial"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-8 max-w-3xl"
                        >
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-stone-800">Setting up the AI (Recommended)</h3>
                                <p className="text-stone-600 leading-relaxed">
                                    To get the fastest and most reliable results, we recommend using <strong>Groq API</strong>. It's incredibly fast (near instant) and offers a generous free tier for developers.
                                </p>

                                <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
                                    <h4 className="font-semibold text-stone-700 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-[#B8925C] text-white flex items-center justify-center text-xs">1</span>
                                        Get your API Key
                                    </h4>
                                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center ml-8">
                                        <a
                                            href="https://console.groq.com/keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                        >
                                            Get Free Groq API Key <ExternalLink size={14} />
                                        </a>
                                        <span className="text-xs text-stone-400">Opens in new tab</span>
                                    </div>
                                </div>

                                <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
                                    <h4 className="font-semibold text-stone-700 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-[#B8925C] text-white flex items-center justify-center text-xs">2</span>
                                        Configure App
                                    </h4>
                                    <div className="ml-8 space-y-2">
                                        <p className="text-sm text-stone-600">Go to <strong>Settings</strong> → <strong>AI Provider</strong> and select <strong>Groq</strong>.</p>
                                        <p className="text-sm text-stone-600">Paste your API Key.</p>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-stone-100" />

                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-stone-800">How to Use DocIA</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:border-[#B8925C]/30 transition-colors">
                                        <h4 className="font-semibold text-[#7C5C3F] mb-1">Upload & Scan</h4>
                                        <p className="text-sm text-stone-600">Upload PDFs or Images. The AI automatically extracts text. Use the "Edit" mode to correct data and "Train" to teach the AI.</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:border-[#B8925C]/30 transition-colors">
                                        <h4 className="font-semibold text-[#7C5C3F] mb-1">Templates</h4>
                                        <p className="text-sm text-stone-600">Define expected fields (e.g., "Invoice Number"). This helps the AI structure the output perfectly every time.</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:border-[#B8925C]/30 transition-colors">
                                        <h4 className="font-semibold text-[#7C5C3F] mb-1">Training (Visual)</h4>
                                        <p className="text-sm text-stone-600">Draw boxes on your documents to show the AI exactly where to look. This improves accuracy for complex layouts.</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:border-[#B8925C]/30 transition-colors">
                                        <h4 className="font-semibold text-[#7C5C3F] mb-1">Enhance Doc</h4>
                                        <p className="text-sm text-stone-600">Turn messy text or scans into professional Word documents. Use the AI Chat to rewrite or translate content.</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'donate' && (
                        <motion.div
                            key="donate"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex flex-col items-center justify-center py-12 text-center space-y-6 max-w-2xl mx-auto"
                        >
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2">
                                <Heart className="w-10 h-10 text-red-500 fill-current animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-bold text-stone-800">Support the Project</h3>
                            <p className="text-stone-600 leading-relaxed">
                                DocIA is built with passion to help you manage documents intelligently.
                                Your support helps cover server costs and fuels development of new features.
                            </p>

                            <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 text-left space-y-3">
                                <h4 className="font-semibold text-stone-700 text-sm">Crypto Donations (Anonymous)</h4>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs bg-white p-2 border border-stone-200 rounded-lg group hover:border-[#B8925C]/30 transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-stone-700">BTC</span>
                                            <span className="text-[10px] text-stone-400">Bitcoin Network</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="bg-stone-100 px-2 py-1 rounded text-stone-800 select-all font-mono break-all max-w-[200px] text-right">14nwggA7oDEg6vWA1BYdEVPmMA9Sxn1ViC</code>
                                            <button
                                                onClick={() => handleCopy("14nwggA7oDEg6vWA1BYdEVPmMA9Sxn1ViC", "BTC")}
                                                className="p-1.5 hover:bg-stone-100 rounded-md transition-colors text-stone-400 hover:text-[#B8925C]"
                                                title="Copy Address"
                                            >
                                                {copiedAddress === "BTC" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs bg-white p-2 border border-stone-200 rounded-lg group hover:border-[#B8925C]/30 transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-stone-700">ETH</span>
                                            <span className="text-[10px] text-stone-400">Ethereum Network</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="bg-stone-100 px-2 py-1 rounded text-stone-800 select-all font-mono break-all max-w-[200px] text-right">0xfc5172a4ad8cf5da636a9c5b3352f868890e51d8</code>
                                            <button
                                                onClick={() => handleCopy("0xfc5172a4ad8cf5da636a9c5b3352f868890e51d8", "ETH")}
                                                className="p-1.5 hover:bg-stone-100 rounded-md transition-colors text-stone-400 hover:text-[#B8925C]"
                                                title="Copy Address"
                                            >
                                                {copiedAddress === "ETH" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs bg-white p-2 border border-stone-200 rounded-lg group hover:border-[#B8925C]/30 transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-stone-700">USDC</span>
                                            <span className="text-[10px] text-stone-400">Base Network</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="bg-stone-100 px-2 py-1 rounded text-stone-800 select-all font-mono break-all max-w-[200px] text-right">0xfc5172a4ad8cf5da636a9c5b3352f868890e51d8</code>
                                            <button
                                                onClick={() => handleCopy("0xfc5172a4ad8cf5da636a9c5b3352f868890e51d8", "USDC")}
                                                className="p-1.5 hover:bg-stone-100 rounded-md transition-colors text-stone-400 hover:text-[#B8925C]"
                                                title="Copy Address"
                                            >
                                                {copiedAddress === "USDC" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-stone-400">Copy the addresses above to your wallet to donate anonymously.</p>
                            </div>

                        </motion.div>
                    )}

                    {activeTab === 'report' && (
                        <motion.div
                            key="report"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="max-w-2xl mx-auto"
                        >
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-stone-800 mb-2">Report a Bug</h3>
                                <p className="text-stone-600 text-sm">
                                    Found an issue? Describe it below and we'll fix it.
                                </p>
                            </div>

                            {submitStatus === 'success' ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center bg-green-50 rounded-xl border border-green-100">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                        <Check className="w-6 h-6 text-green-600" />
                                    </div>
                                    <h4 className="text-lg font-bold text-green-800">Report Sent!</h4>
                                    <p className="text-green-600 text-sm">Thank you for helping us improve.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleBugSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">What happened?</label>
                                        <textarea
                                            required
                                            value={bugForm.description}
                                            onChange={e => setBugForm({ ...bugForm, description: e.target.value })}
                                            placeholder="Describe the error, what you were doing, and what you expected to happen..."
                                            className="w-full min-h-[120px] p-3 rounded-xl border border-stone-200 focus:border-[#B8925C] focus:ring-2 focus:ring-[#B8925C]/20 outline-none resize-none bg-stone-50 focus:bg-white transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Screenshot (Optional)</label>
                                        <div className="p-4 border-2 border-dashed border-stone-200 rounded-xl hover:border-[#B8925C]/50 hover:bg-[#B8925C]/5 transition-all text-center cursor-pointer relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={e => setBugImage(e.target.files?.[0] || null)}
                                            />
                                            <div className="flex flex-col items-center gap-2 pointer-events-none">
                                                <ImageIcon className="w-6 h-6 text-stone-400" />
                                                {bugImage ? (
                                                    <span className="text-sm font-medium text-[#B8925C]">{bugImage.name}</span>
                                                ) : (
                                                    <span className="text-sm text-stone-500">Click to upload or drag image here</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Contact Email (Optional)</label>
                                        <input
                                            type="email"
                                            value={bugForm.contact}
                                            onChange={e => setBugForm({ ...bugForm, contact: e.target.value })}
                                            placeholder="If you want us to follow up..."
                                            className="w-full p-2.5 rounded-xl border border-stone-200 focus:border-[#B8925C] focus:ring-2 focus:ring-[#B8925C]/20 outline-none bg-stone-50 focus:bg-white transition-all"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-[#7C5C3F] text-white rounded-xl font-medium hover:bg-[#664D35] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            "Sending..."
                                        ) : (
                                            <>
                                                <Send size={16} /> Submit Report
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
