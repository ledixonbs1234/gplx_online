// plx_online/components/DecisionTreeChart.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DayReport } from '@/types/candidate';
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
});

interface DecisionTreeChartProps {
  report: DayReport;
}

export function DecisionTreeChart({ report }: DecisionTreeChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    renderChart();
  }, [report]);

  const totalPendingGPLX = report.with_app_and_fee.pending + report.without_fee.pending;

  const renderChart = async () => {
    if (!chartRef.current) return;

    const chartDefinition = `
flowchart TD
    A["📋 Tổng: ${report.total_candidates} người<br/>Ngày: ${report.date}"] --> B{"Có hồ sơ?"}
    
    B -->|Không| C["❌ Không hồ sơ<br/>${report.no_profile_count} người"]
    C --> D["🚫 Rớt<br/>${report.fail_count} người<br/><i>Cần lọc DS</i>"]
    
    B -->|Có| E{"Thi đậu?"}
    
    E -->|Rớt| D
    
    E -->|Đậu ${report.pass_count}| F{"Đã Nộp Tiền?"}
    
    F -->|Có ${report.with_app_and_fee.total}| G{"GPLX về?"}
    F -->|Không ${report.without_fee.total}| H{"GPLX về?"}
    
    G -->|Có| I["✅ Đã nộp + Có GPLX<br/>${report.with_app_and_fee.returned} người"]
    G -->|Chưa| J["⏳ Đã nộp - Chờ GPLX<br/>${report.with_app_and_fee.pending} người"]
    
    H -->|Có| K["📬 Chưa nộp + Có GPLX<br/>${report.without_fee.returned} người"]
    H -->|Chưa| L["⏸️ Chưa nộp - Chờ GPLX<br/>${report.without_fee.pending} người"]
    
    J --> M["📌 TỔNG CHƯA CÓ GPLX<br/>${totalPendingGPLX} người"]
    L --> M
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff,stroke-width:2px
    style B fill:#fbbf24,stroke:#d97706,color:#000
    style C fill:#ef4444,stroke:#991b1b,color:#fff
    style D fill:#f97316,stroke:#c2410c,color:#fff
    style E fill:#fbbf24,stroke:#d97706,color:#000
    style F fill:#fbbf24,stroke:#d97706,color:#000
    style G fill:#fbbf24,stroke:#d97706,color:#000
    style H fill:#fbbf24,stroke:#d97706,color:#000
    style I fill:#10b981,stroke:#065f46,color:#fff
    style J fill:#eab308,stroke:#a16207,color:#fff
    style K fill:#3b82f6,stroke:#1e40af,color:#fff
    style L fill:#a855f7,stroke:#6b21a8,color:#fff
    style M fill:#dc2626,stroke:#7f1d1d,color:#fff,stroke-width:3px
    `;

    try {
      const { svg } = await mermaid.render('decision-tree', chartDefinition);
      setSvgContent(svg);
      if (chartRef.current) {
        chartRef.current.innerHTML = svg;
      }
    } catch (error) {
      console.error('Lỗi render Mermaid:', error);
    }
  };

  const downloadSVG = () => {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `decision-tree-${report.date}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            🌳 Sơ đồ cây quyết định - {report.date}
          </CardTitle>
          <Button onClick={downloadSVG} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Tải SVG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={chartRef} 
          className="w-full overflow-auto bg-white p-4 rounded-lg border flex justify-center"
          style={{ minHeight: '400px' }}
        />
      </CardContent>
    </Card>
  );
}