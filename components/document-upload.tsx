"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, ImageIcon, FileSpreadsheet, Presentation, Code, X, CheckCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: "uploading" | "processing" | "completed" | "error"
  progress: number
}

const SUPPORTED_FORMATS = {
  "application/pdf": { icon: FileText, label: "PDF", color: "bg-red-100 text-red-800" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: FileText,
    label: "DOCX",
    color: "bg-blue-100 text-blue-800",
  },
  "text/html": { icon: Code, label: "HTML", color: "bg-orange-100 text-orange-800" },
  "text/csv": { icon: FileSpreadsheet, label: "CSV", color: "bg-green-100 text-green-800" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    icon: FileSpreadsheet,
    label: "XLSX",
    color: "bg-green-100 text-green-800",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    icon: Presentation,
    label: "PPTX",
    color: "bg-purple-100 text-purple-800",
  },
  "image/jpeg": { icon: ImageIcon, label: "JPEG", color: "bg-pink-100 text-pink-800" },
  "image/png": { icon: ImageIcon, label: "PNG", color: "bg-pink-100 text-pink-800" },
  "application/x-ipynb+json": { icon: Code, label: "Notebook", color: "bg-yellow-100 text-yellow-800" },
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => item.str).join(' ') + '\n'
  }
  return text
}

export default function DocumentUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const { session } = useAuth()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading",
      progress: 0,
    }))

    setUploadedFiles((prev) => [...prev, ...newFiles])

    // Process each file
    for (const file of acceptedFiles) {
      const fileId = newFiles.find((f) => f.name === file.name)?.id
      if (!fileId) continue

      try {
        let extractedText = ''
        if (file.type === 'application/pdf') {
          extractedText = await extractTextFromPDF(file)
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("extractedText", extractedText)

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === fileId && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f)),
          )
        }, 200)

        const response = await fetch("/api/documents/upload", {
            method: "POST",
            body: formData,
            headers: {
              ...(session?.access_token && {
                Authorization: `Bearer ${session.access_token}`,
              }),
            },
          })

          clearInterval(progressInterval)

          if (response.ok) {
            setUploadedFiles((prev) =>
              prev.map((f) => (f.id === fileId ? { ...f, status: "completed", progress: 100 } : f)),
            )
            toast({
              title: "Document processed successfully",
              description: `${file.name} is ready for analysis`,
            })
          } else {
            throw new Error("Upload failed")
          }
      } catch (error) {
        setUploadedFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "error", progress: 0 } : f)))
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        })
      }
    }
  }, [session])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: Object.keys(SUPPORTED_FORMATS).reduce(
      (acc, key) => {
        acc[key] = []
        return acc
      },
      {} as Record<string, string[]>,
    ),
    maxSize: 100 * 1024 * 1024, // 100MB
  })

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Support for PDF, DOCX, HTML, CSV, Excel, PowerPoint, Jupyter notebooks, and images
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">Drag & drop files here, or click to select files</p>
                <p className="text-sm text-gray-500">Maximum file size: 100MB</p>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Object.entries(SUPPORTED_FORMATS).map(([type, config]) => {
              const Icon = config.icon
              return (
                <Badge key={type} variant="secondary" className={`${config.color} justify-center py-2`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((file) => {
                const formatConfig = SUPPORTED_FORMATS[file.type as keyof typeof SUPPORTED_FORMATS]
                const Icon = formatConfig?.icon || ImageIcon

                return (
                  <div key={file.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <Icon className="w-8 h-8 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      {file.status === "uploading" && <Progress value={file.progress} className="mt-2" />}
                      {file.status === "processing" && (
                        <div className="mt-2 flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-600">Processing...</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {file.status === "completed" && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {file.status === "error" && <X className="w-5 h-5 text-red-500" />}
                      <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
