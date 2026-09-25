export async function salesRequest<T>(token:string,path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(60000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'The request could not finish. Please try again.');return data as T;
}
