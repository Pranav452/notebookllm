import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ForceGraph2D } from 'react-force-graph'
import { tsne } from 'tsne-js'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import { Loader2, FileText, ImageIcon, FileSpreadsheet, Presentation, Code } from 'lucide-react'
import anime from 'animejs'

interface Document {
  id: string
  name: string
  file_type: string
  document_embedding: number[]
}

interface GraphNode {
  id: string
  name: string
  file_type: string
  x?: number
  y?: number
  _r?: number; // Animated radius
  _a?: number; // Animated alpha
}

interface GraphLink {
  source: string
  target: string
  value: number
}

const getFileIcon = (type: string) => {
  if (type.includes("pdf")) return FileText
  if (type.includes("image")) return ImageIcon
  if (type.includes("spreadsheet")) return FileSpreadsheet
  if (type.includes("presentation")) return Presentation
  if (type.includes("html") || type.includes("json")) return Code
  return FileText
}

export default function DocumentGraphVisualization() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [tsneRunning, setTsneRunning] = useState(false)
  const { session } = useAuth()
  const fgRef = useRef<any>()

  const fetchData = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/documents", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Filter out documents without embeddings for now
        const docsWithEmbeddings = data.documents.filter((doc: Document) => doc.document_embedding && doc.document_embedding.length > 0)
        setDocuments(docsWithEmbeddings)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch documents for visualization",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching documents for graph:", error)
      toast({
        title: "Error",
        description: "Failed to fetch documents for visualization",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (documents.length > 1 && !tsneRunning) {
      setTsneRunning(true)
      console.log("Starting t-SNE computation...")

      const embeddings = documents.map(doc => doc.document_embedding)
      const tsneModel = new tsne.TSNE({
        dim: 2, // Reduce to 2 dimensions for 2D graph
        perplexity: Math.min(30, documents.length - 1), // Perplexity should be less than data points
        earlyExaggeration: 4.0,
        learningRate: 100,
        nIter: 500,
        metric: 'euclidean'
      })

      tsneModel.init({ data: embeddings, type: 'dense' })

      tsneModel.on('progress', function(iter: number, error: number, coords: number[][]) {
        if (iter % 50 === 0) {
          console.log(`t-SNE iteration ${iter}, error: ${error}`)
        }
        if (iter === tsneModel.get  ('nIter') - 1) {
          console.log("t-SNE computation finished.")
          const nodes: GraphNode[] = documents.map((doc, i) => ({
            id: doc.id,
            name: doc.name,
            file_type: doc.file_type,
            x: coords[i][0],
            y: coords[i][1],
            _r: 0, // Start radius at 0 for animation
            _a: 0, // Start alpha at 0 for animation
          }))

          // Calculate links based on similarity (e.g., top N most similar)
          const links: GraphLink[] = []
          // This is a simplified approach. For true similarity, you'd re-query the backend
          // or pre-calculate similarities. For now, we'll just connect nearby nodes in t-SNE space.
          // A more robust solution would involve fetching similar documents from the backend.
          
          // For demonstration, let's connect each node to its 2 nearest neighbors in t-SNE space
          // This is NOT semantic similarity, but spatial proximity in the reduced dimension.
          // To get semantic similarity, we would need to query the backend's similar documents API.
          
          // For now, we'll just create a basic graph without explicit similarity links
          // as calculating them all here would be too intensive and redundant with backend.
          // The visual proximity in t-SNE space will imply similarity.

          setGraphData({ nodes, links })
          setTsneRunning(false)

          // Animate nodes using anime.js
          anime({
            targets: nodes,
            _r: 5, // Animate radius to 5
            _a: 1, // Animate alpha to 1
            duration: 1000,
            easing: 'easeOutQuad',
            delay: anime.stagger(50), // Stagger animation for a nice effect
            update: () => {
              // Force graph to re-render with updated node properties
              fgRef.current.refresh();
            }
          });
        }
      })

      tsneModel.run()
    }
  }, [documents, tsneRunning])

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(51, 51, 51, ${node._a || 0})`; // Use animated alpha for text
    ctx.fillText(label, node.x || 0, (node.y || 0) + 10); // Offset text below node

    // Draw a circle for the node
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, node._r || 0, 0, 2 * Math.PI, false); // Use animated radius
    ctx.fillStyle = `rgba(102, 102, 102, ${node._a || 0})`; // Use animated alpha for fill
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${node._a || 0})`; // Use animated alpha for stroke
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
  }, []);

  const nodePointerAreaPaint = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, (node._r || 0) + 2, 0, 2 * Math.PI, false); // Use animated radius + buffer
    ctx.fill();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading documents for visualization...</span>
      </div>
    )
  }

  if (documents.length <= 1) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Not enough documents for visualization</h3>
        <p className="text-gray-500">Upload at least two documents with embeddings to see the graph.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-[600px] border rounded-lg shadow-sm overflow-hidden">
      {tsneRunning && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-blue-600">Computing t-SNE layout...</span>
        </div>
      )}
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkWidth={link => link.value * 2} // Example: Thicker links for higher similarity
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        width={window.innerWidth * 0.8} // Adjust based on your layout
        height={600}
        onNodeClick={(node) => {
          // Handle node click, e.g., show document details
          console.log("Node clicked:", node.name);
        }}
      />
    </div>
  )
}
