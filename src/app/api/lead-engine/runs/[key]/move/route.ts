import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {database,readJson,IntegrationError,apiError} from '@/services/integration.service';
import {validSessionId} from '@/lib/caller-validation';
export async function POST(request:Request,{params}:{params:Promise<{key:string}>}){try{const user=await requireWorkspaceAdmin(request),{key}=await params,b=await readJson(request) as {folderId:unknown};if(!b||b.folderId!==null&&!validSessionId(b.folderId))throw new IntegrationError(400,'Choose a folder.');const {error}=await database().rpc('nbc_lead_run_move',{p_owner:user.id,p_key:key,p_folder:b.folderId});if(error)throw new IntegrationError(409,'The list or folder is unavailable to your account.');return Response.json({saved:true});}catch(e){return apiError(e);}}
