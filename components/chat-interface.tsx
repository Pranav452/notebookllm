"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Send, Bot, User, FileText, BarChart3, Paperclip, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: Array<{
    document_id: string
    content: string
    similarity: number
    metadata: {
      embedding_model?: string
      [key: string]: any
    }
  }>
  decomposedQueries?: string[]
}

const initialMessage: Message = {
  id: "1",
  type: "assistant",
  content:
    "Hello! I'm your multimodal research assistant. I can help you analyze documents, answer questions about your uploaded content, and provide insights across text, images, tables, and code. What would you like to explore today?",
  timestamp: new Date(),
}

const suggestedQueries = [
  "Compare financial performance across quarters",
  "Extract key metrics from the presentation",
  "Analyze code patterns in the notebook",
  "Summarize research methodology",
  "Find relationships between documents",
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { session, loading: authLoading } = useAuth()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!session?.access_token || authLoading) return

      try {
        const response = await fetch("/api/chat/history", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const historyMessages: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            type: msg.message ? "user" : "assistant", // Assuming 'message' is user, 'response' is assistant
            content: msg.message || msg.response,
            timestamp: new Date(msg.created_at),
            sources: msg.sources || [],
          }))
          
          // Filter out the initial message if it's already in history
          const filteredHistory = historyMessages.filter(msg => msg.id !== initialMessage.id)

          if (filteredHistory.length === 0) {
            setMessages([initialMessage])
          } else {
            setMessages(filteredHistory)
          }
        } else {
          console.error("Failed to fetch chat history")
          setMessages([initialMessage]) // Fallback to initial message on error
        }
      } catch (error) {
        console.error("Error fetching chat history:", error)
        setMessages([initialMessage]) // Fallback to initial message on error
      }
    }

    fetchChatHistory()
  }, [session, authLoading])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !session?.access_token) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentMessage = inputValue
    setInputValue("")
    setIsLoading(true)

    try {
      // Send message to chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: currentMessage,
          history: messages.slice(-10), // Include last 10 messages for context
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: data.response,
          timestamp: new Date(),
          sources: data.sources || [],
          decomposedQueries: data.decomposedQueries || [],
        }

        setMessages((prev) => [...prev, assistantMessage])
      } else {
        throw new Error("Failed to get response")
      }
    } catch (error) {
      console.error("Chat error:", error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "I apologize, but I encountered an error while processing your request. Please try again or check your connection.",
        timestamp: new Date(),
      }
      
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestedQuery = (query: string) => {
    setInputValue(query)
  }

  return (
    <div className="space-y-6">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b px-6 py-4">
          <CardTitle className="flex items-center space-x-3 text-lg">
            <Bot className="w-6 h-6 text-blue-600" />
            <span>Multimodal Chat</span>
            <Badge variant="secondary" className="ml-auto px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Powered
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl p-4 shadow-md ${
                    message.type === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white ml-auto"
                      : "bg-white text-gray-800 mr-auto border border-gray-200"
                  }`}
                >
                  <div className="flex items-start space-x-3 mb-2">
                    {message.type === "assistant" ? (
                      <Bot className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    ) : (
                      <User className="w-6 h-6 text-gray-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</div>

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-300/50 space-y-3">
                          <div className="text-xs font-semibold text-gray-700 opacity-80">Sources:</div>
                          {message.sources.map((source, index) => (
                            <div key={index} className="bg-gray-100 rounded-lg p-3 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-3 h-3 text-gray-600" />
                                  <span className="text-xs font-medium text-gray-700">Document {index + 1}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {source.metadata?.embedding_model && (
                                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                                      Model: {source.metadata.embedding_model}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border-green-200">
                                    {Math.round(source.similarity * 100)}% match
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 line-clamp-2">{source.content}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {message.decomposedQueries && message.decomposedQueries.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-300/50 space-y-2">
                          <div className="text-xs font-semibold text-gray-700 opacity-80">Decomposed Queries:</div>
                          <ul className="list-disc list-inside text-xs text-gray-600">
                            {message.decomposedQueries.map((query, index) => (
                              <li key={index}>{query}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs opacity-60 mt-2 text-right">{message.timestamp.toLocaleTimeString()}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl p-4 shadow-md max-w-[75%] mr-auto border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Bot className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4 bg-white">
            <div className="flex flex-wrap gap-2 mb-4 px-4">
              {suggestedQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedQuery(query)}
                  className="text-sm rounded-full px-4 py-2 h-auto border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  {query}
                </Button>
              ))}
            </div>

            <div className="flex space-x-3 px-4 pb-4">
              <div className="flex-1 relative">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask anything about your documents..."
                  className="min-h-[50px] pr-12 resize-none rounded-xl border-gray-300 focus-visible:ring-blue-500 shadow-sm text-base p-3"
                  disabled={isLoading}
                />
                <Button variant="ghost" size="sm" className="absolute right-2 top-2 text-gray-500 hover:text-blue-600 rounded-full w-8 h-8 p-0">
                  <Paperclip className="w-4 h-4" />
                </Button>
              </div>
              <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading} className="self-end rounded-xl bg-blue-600 hover:bg-blue-700 h-[50px] w-[50px] p-0">
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
