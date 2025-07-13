import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface SummaryDisplayModalProps {
  isOpen: boolean
  onClose: () => void
  summary: string
  documentNames: string[]
}

export default function SummaryDisplayModal({ isOpen, onClose, summary, documentNames }: SummaryDisplayModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Multi-Document Summary</DialogTitle>
          <DialogDescription>
            An executive summary generated from the selected documents.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Summarized Documents:</h3>
          <div className="flex flex-wrap gap-2">
            {documentNames.map((name, index) => (
              <Badge key={index} variant="secondary" className="px-3 py-1 text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 border rounded-md bg-gray-50 text-gray-800 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{summary}</p>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
