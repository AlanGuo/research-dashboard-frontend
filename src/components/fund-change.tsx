import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { FundChangeResponse } from "@/app/u/[username]/page";

interface FundChangeProps {
  fundChangeData: FundChangeResponse | null;
}

export function FundChange({ fundChangeData }: FundChangeProps) {
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [totalWithdrawal, setTotalWithdrawal] = useState(0);
  
  // 使用从父组件传入的数据
  const changeData = fundChangeData;
  
  // 计算总入金和总出金
  useEffect(() => {
    if (changeData && changeData.success && changeData.data) {
      let deposit = 0;
      let withdrawal = 0;
      
      changeData.data.forEach((item) => {
        if (item["操作"] === "入金" || item["操作"] === "初始本金") {
          deposit += item["金额"];
        } else if (item["操作"] === "出金") {
          withdrawal += item["金额"];
        }
      });
      
      setTotalDeposit(deposit);
      setTotalWithdrawal(withdrawal);
    }
  }, [changeData]);

  if (!changeData || !changeData.success || !changeData.data || changeData.data.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-4 text-muted-foreground">暂无出入金记录</p>
      </div>
    );
  }

  // 计算净入金
  const netChange = totalDeposit - totalWithdrawal;

  return (
    <div className="space-y-4">
      {/* 出入金统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">总入金</span>
              <span className="text-xl font-bold text-green-600">+${totalDeposit.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">总出金</span>
              <span className="text-xl font-bold text-red-600">-${totalWithdrawal.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">净入金</span>
              <span className={`text-xl font-bold ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netChange >= 0 ? '+' : ''}{netChange.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 桌面版表格 - 在中等及以上屏幕显示 */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{width: '20%'}}>日期</TableHead>
              <TableHead style={{width: '15%'}}>操作</TableHead>
              <TableHead className="text-right" style={{width: '20%'}}>金额</TableHead>
              <TableHead className="text-right"style={{width: '45%'}}>备注</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changeData.data.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item["日期"]}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    item["操作"] === "入金" || item["操作"] === "初始本金" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : 
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    {item["操作"]}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={item["操作"] === "入金" || item["操作"] === "初始本金" ? "text-green-600" : "text-red-600"}>
                    {item["操作"] === "入金" || item["操作"] === "初始本金" ? "+" : "-"}${Math.abs(item["金额"]).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{item["备注"] || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* 移动版卡片 - 在小屏幕显示 */}
      <div className="md:hidden space-y-3">
        {changeData.data.map((item, index) => (
          <div key={index} className="rounded-lg border bg-card text-card-foreground p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">{item["日期"]}</div>
              <span className={`px-2 py-1 rounded-full text-xs ${
                item["操作"] === "入金" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : 
                "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {item["操作"]}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">金额</div>
              <div className={`font-medium ${item["操作"] === "入金" || item["操作"] === "初始本金" ? "text-green-600" : "text-red-600"}`}>
                {item["操作"] === "入金" || item["操作"] === "初始本金" ? "+" : "-"}${Math.abs(item["金额"]).toLocaleString()}
              </div>
            </div>
            {item["备注"] && (
              <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                {item["备注"]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
