import { useEffect, useState } from "react";
import Weekly from "./pages/Weekly.jsx";
import Reports from "./pages/Reports.jsx";
import AuthModal from "./pages/Auth.jsx";
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

const LOGO_URL =
"https://firebasestorage.googleapis.com/v0/b/cnlb-4d714.firebasestorage.app/o/lOGO%20DOC.png?alt=media&token=ad7d71e2-aa27-4ed5-81d8-9f8ee9ace0ac";

export default function App(){

const [tab,setTab]=useState("weekly");
const [authOpen,setAuthOpen]=useState(false);
const [authed,setAuthed]=useState(false);
const [userEmail,setUserEmail]=useState("");

useEffect(()=>{

const unsub=onAuthStateChanged(auth,(u)=>{

setAuthed(!!u);
setUserEmail(u?.email||"Chưa đăng nhập");
setAuthOpen(!u);

});

return ()=>unsub();

},[]);

async function logout(){

await signOut(auth);

}

return (

<div>

<header>

<div className="header-inner">

<div className="brand">

<img src={LOGO_URL}/>

<div className="title">

<h1>Hệ thống báo cáo hiệu quả làm việc thông minh bằng AI</h1>

<p>VP-PHARM · AI Weekly Sales Intelligence</p>

</div>

</div>

<div className="row">

<div className="pill">

<span className="small">User:</span>

<span className="kbd">{userEmail}</span>

</div>

{authed && (

<>

<button

className="btn secondary"

onClick={()=>setTab("weekly")}

>

Weekly

</button>

<button

className="btn secondary"

onClick={()=>setTab("reports")}

>

Reports

</button>

<button

className="btn secondary"

onClick={logout}

>

Đăng xuất

</button>

</>

)}

</div>

</div>

</header>

<div className="container">

{!authed && (

<div className="card">

<div className="card-body">

<h2>Chưa đăng nhập</h2>

<p className="small">

Vui lòng đăng nhập để sử dụng hệ thống báo cáo tuần.

</p>

<button

className="btn"

onClick={()=>setAuthOpen(true)}

>

Đăng nhập

</button>

</div>

</div>

)}

{authed && tab==="weekly" && <Weekly/>}

{authed && tab==="reports" && <Reports/>}

</div>

<AuthModal

open={authOpen}

onClose={()=>setAuthOpen(false)}

/>

<footer>

<div className="container">

<div className="small">

<b>CÔNG TY CỔ PHẦN DƯỢC VP-PHARM</b>

<br/>

Địa chỉ: Lô B1.4-LK12 KĐT Thanh Hà

<br/>

Điện thoại: 0975 498 284

<br/>

Công nghệ giúp điều hành bán hàng hiệu quả hơn với AI

</div>

</div>

</footer>

</div>

);

}