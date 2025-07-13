"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  FileText,
  ImageIcon,
  FileSpreadsheet,
  Presentation,
  Code,
  Calendar,
  Download,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { List } from "lucide-react"
import SummaryDisplayModal from "@/components/summary-display-modal"

interface Document {
  id: string
  name: string
  file_type: string
  file_size: number
  created_at: string
  status: "processing" | "completed" | "error"
  summary?: string
  tags: string[]
  page_count?: number
  image_count?: number
}

interface SimilarDocument {
  id: string
  name: string
  file_type: string
  similarity: number
}

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [showSimilarDocumentsModal, setShowSimilarDocumentsModal] = useState(false)
  const [similarDocuments, setSimilarDocuments] = useState<SimilarDocument[]>([])
  const [isFindingSimilar, setIsFindingSimilar] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [generatedSummary, setGeneratedSummary] = useState("")
  const [summarizedDocumentNames, setSummarizedDocumentNames] = useState<string[]>([])
  const { session } = useAuth()

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!session?.access_token) return

      try {
        const response = await fetch("/api/documents", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setDocuments(data.documents || [])
        } else {
          toast({
            title: "Error",
            description: "Failed to fetch documents",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching documents:", error)
        toast({
          title: "Error",
          description: "Failed to fetch documents",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [session, toast])

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return FileText
    if (type.includes("image")) return ImageIcon
    if (type.includes("spreadsheet")) return FileSpreadsheet
    if (type.includes("presentation")) return Presentation
    if (type.includes("html") || type.includes("json")) return Code
    return FileText
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.tags || []).some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    if (selectedFilter === "all") return matchesSearch
    return matchesSearch && doc.file_type.includes(selectedFilter)
  })

  const deleteDocument = async (documentId: string) => {
    if (!session?.access_token) return

    try {
      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId))
        toast({
          title: "Success",
          description: "Document deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete document",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting document:", error)
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      })
    }
  }

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(documentId) ? prev.filter(id => id !== documentId) : [...prev, documentId]
    )
  }

  const handleGenerateSummary = async () => {
    if (selectedDocuments.length === 0 || !session?.access_token) return

    setIsSummarizing(true)
    try {
      const response = await fetch("/api/documents/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentIds: selectedDocuments }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedSummary(data.summary)
        setSummarizedDocumentNames(selectedDocuments.map(id => documents.find(doc => doc.id === id)?.name || 'Unknown Document'))
        setShowSummaryModal(true)
        toast({
          title: "Multi-Document Summary Generated",
          description: "Summary is ready and displayed in a modal.",
        })
      } else {
        throw new Error("Failed to generate multi-document summary")
      }
    } catch (error) {
      console.error("Error generating multi-document summary:", error)
      toast({
        title: "Error",
        description: "Failed to generate multi-document summary.",
        variant: "destructive",
      })
    } finally {
      setIsSummarizing(false)
      setSelectedDocuments([]) // Clear selection after summarization
    }
  }

  const handleFindSimilarDocuments = async (documentId: string) => {
    if (!session?.access_token) return

    setIsFindingSimilar(true)
    try {
      const response = await fetch("/api/documents/similar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentId }),
      })

      if (response.ok) {
        const data = await response.json()
        setSimilarDocuments(data.similarDocuments)
        setShowSimilarDocumentsModal(true)
      } else {
        throw new Error("Failed to find similar documents")
      }
    } catch (error) {
      console.error("Error finding similar documents:", error)
      toast({
        title: "Error",
        description: "Failed to find similar documents.",
        variant: "destructive",
      })
    } finally {
      setIsFindingSimilar(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
          <CardDescription>Manage and explore your uploaded documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search documents, content, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pdf">PDF</TabsTrigger>
                <TabsTrigger value="spreadsheet">Excel</TabsTrigger>
                <TabsTrigger value="presentation">PPT</TabsTrigger>
                <TabsTrigger value="image">Images</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="mb-4 flex justify-end">
            <Button
              onClick={handleGenerateSummary}
              disabled={selectedDocuments.length === 0 || isSummarizing}
            >
              {isSummarizing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Summary...</>
              ) : (
                "Generate Multi-Document Summary"
              )}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading documents...</span>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDocuments.map((doc) => {
                const Icon = getFileIcon(doc.file_type)

                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={() => toggleDocumentSelection(doc.id)}
                        />
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="w-6 h-6 text-gray-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">{doc.name}</h3>
                            <Badge
                              variant={doc.status === "completed" ? "default" : "secondary"}
                              className={doc.status === "completed" ? "bg-green-100 text-green-800" : ""}
                            >
                              {doc.status}
                            </Badge>
                          </div>

                          {doc.summary && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{doc.summary}</p>}

                          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(doc.created_at)}
                            </span>
                            <span>{formatFileSize(doc.file_size)}</span>
                            {doc.page_count && <span>{doc.page_count} pages</span>}
                            {doc.image_count && <span>{doc.image_count} images</span>}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1">
                              {(doc.tags || []).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Download className="w-4 h-4 mr-1" />
                                Export
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => deleteDocument(doc.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleFindSimilarDocuments(doc.id)}
                                disabled={isFindingSimilar}
                              >
                                {isFindingSimilar ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <><List className="w-4 h-4 mr-1" /> Similar</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-500">
                {searchTerm ? "Try adjusting your search terms" : "Upload some documents to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSimilarDocumentsModal} onOpenChange={setShowSimilarDocumentsModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Similar Documents</DialogTitle>
            <DialogDescription>
              Documents similar to the one you selected, based on content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {similarDocuments.length === 0 ? (
              <p className="text-center text-gray-500">No similar documents found.</p>
            ) : (
              similarDocuments.map((doc) => {
                const Icon = getFileIcon(doc.file_type)
                return (
                  <div key={doc.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Icon className="w-5 h-5 text-gray-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(doc.similarity * 100)}% similarity
                      </Badge>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SummaryDisplayModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        summary={generatedSummary}
        documentNames={summarizedDocumentNames}
      />
    </div>
  )
}
