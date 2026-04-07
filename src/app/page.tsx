import { redirect } from "next/navigation";

export default function Home() {
  // 온보딩 완료 여부는 클라이언트에서 확인 (localStorage)
  // 서버에서는 일단 /dashboard로 보내고, 클라이언트에서 처리
  redirect("/dashboard");
}
