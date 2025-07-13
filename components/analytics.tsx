"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { FileText, MessageSquare, TrendingUp, Clock, Target, Zap, Brain, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

interface AnalyticsData {
  overview: {
    totalDocuments: number
    totalQueries: number
    documentGrowth: number
    queryGrowth: number
    averageResponseTime: string
    accuracyScore: string
  }
  documentTypes: Array<{
    name: string
    count: number
    color: string
  }>
  queryTrends: Array<{
    date: string
    queries: number
  }>
  documentStatus: {
    completed: number
    processing: number
    error: number
  }
}

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const { session } = useAuth()

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!session?.access_token) return

      try {
        const response = await fetch("/api/analytics", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setAnalyticsData(data)
        } else {
          toast({
            title: "Error",
            description: "Failed to fetch analytics data",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching analytics:", error)
        toast({
          title: "Error",
          description: "Failed to fetch analytics data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [session, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No analytics data available.</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.totalDocuments}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{analyticsData.overview.documentGrowth}% this week
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Queries</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.totalQueries}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{analyticsData.overview.queryGrowth}% this week
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.averageResponseTime}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <Zap className="w-3 h-3 mr-1" />
                  Optimized
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Accuracy Score</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.accuracyScore}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <Target className="w-3 h-3 mr-1" />
                  High Quality
                </p>
              </div>
              <Brain className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Document Types Distribution</CardTitle>
            <CardDescription>Breakdown of uploaded document formats</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData.documentTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.documentTypes}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    label={({ name, percent }: { name: string; percent?: number }) => 
                      `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`
                    }
                  >
                    {analyticsData.documentTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No documents uploaded yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Query Trends</CardTitle>
            <CardDescription>Daily query volume over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.queryTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                />
                <YAxis />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                <Line type="monotone" dataKey="queries" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Document Status */}
      <Card>
        <CardHeader>
          <CardTitle>Document Processing Status</CardTitle>
          <CardDescription>Current status of uploaded documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Completed Documents</h4>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {analyticsData.documentStatus.completed} docs
                  </Badge>
                </div>
                <Progress value={analyticsData.overview.totalDocuments > 0 ? 
                  (analyticsData.documentStatus.completed / analyticsData.overview.totalDocuments) * 100 : 0
                } className="h-2" />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Processing Documents</h4>
                  <Badge variant="secondary">
                    {analyticsData.documentStatus.processing} docs
                  </Badge>
                </div>
                <Progress value={analyticsData.overview.totalDocuments > 0 ? 
                  (analyticsData.documentStatus.processing / analyticsData.overview.totalDocuments) * 100 : 0
                } className="h-2" />
              </div>
            </div>
            
            {analyticsData.documentStatus.error > 0 && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Error Documents</h4>
                    <Badge variant="destructive">
                      {analyticsData.documentStatus.error} docs
                    </Badge>
                  </div>
                  <Progress value={analyticsData.overview.totalDocuments > 0 ? 
                    (analyticsData.documentStatus.error / analyticsData.overview.totalDocuments) * 100 : 0
                  } className="h-2" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing Speed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">PDF Processing</span>
                <span className="text-sm font-medium">1.2s avg</span>
              </div>
              <Progress value={85} className="h-2" />

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Image Analysis</span>
                <span className="text-sm font-medium">0.8s avg</span>
              </div>
              <Progress value={92} className="h-2" />

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Text Extraction</span>
                <span className="text-sm font-medium">0.3s avg</span>
              </div>
              <Progress value={98} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Query Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Summarization</span>
                <Badge variant="secondary">34%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Q&A</span>
                <Badge variant="secondary">28%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Analysis</span>
                <Badge variant="secondary">22%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Comparison</span>
                <Badge variant="secondary">16%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-3xl font-bold text-green-600">4.8/5</div>
              <div className="text-sm text-gray-600">Average Rating</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>5 stars</span>
                  <div className="flex-1 mx-2">
                    <Progress value={78} className="h-1" />
                  </div>
                  <span>78%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>4 stars</span>
                  <div className="flex-1 mx-2">
                    <Progress value={15} className="h-1" />
                  </div>
                  <span>15%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>3 stars</span>
                  <div className="flex-1 mx-2">
                    <Progress value={5} className="h-1" />
                  </div>
                  <span>5%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
