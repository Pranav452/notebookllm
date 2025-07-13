"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, MessageSquare, BarChart3, Settings, LogOut } from "lucide-react"
import dynamic from 'next/dynamic'

const DocumentUpload = dynamic(() => import('@/components/document-upload'), { ssr: false })
const DocumentGraphVisualization = dynamic(() => import('@/components/document-graph-visualization'), { ssr: false })
import DocumentLibrary from "@/components/document-library"
import ChatInterface from "@/components/chat-interface"
import Analytics from "@/components/analytics"
import { useAuth } from "@/hooks/use-auth"
import AuthModal from "@/components/auth-modal"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("upload")
  const { user, loading, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthModal(true)
    }
  }, [user, loading])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              NotebookLLM Pro
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <span className="text-sm text-gray-600">Welcome, {user.user_metadata?.full_name || user.email}</span>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Multimodal Research Assistant</h2>
          <p className="text-gray-600 text-lg">Upload, analyze, and chat with your documents using advanced AI</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[500px]">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Library</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="visualization" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Visualization</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <DocumentUpload />
          </TabsContent>

          <TabsContent value="library" className="space-y-6">
            <DocumentLibrary />
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <ChatInterface />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Analytics />
          </TabsContent>

          <TabsContent value="visualization" className="space-y-6">
            <DocumentGraphVisualization />
          </TabsContent>
        </Tabs>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
