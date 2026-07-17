import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, Lock, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "../hooks/use-auth";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: authenticate, token } = useAuth();
  const loginMutation = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  React.useEffect(() => {
    if (token) {
      setLocation("/dashboard");
    }
  }, [token, setLocation]);

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        toast.success("Authentication successful");
        authenticate(res.token, res.user);
        setLocation("/dashboard");
      },
      onError: (err) => {
        toast.error("Authentication failed. Invalid credentials.");
      }
    });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background industrial elements */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none">
        <Shield size={800} />
      </div>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950 pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-10 overflow-hidden backdrop-blur-sm">
        <div className="h-1 bg-amber-500 w-full"></div>
        <div className="p-8">
          <div className="flex flex-col items-center justify-center text-center mb-8">
            <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center mb-4 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-mono">MetalWorks</h1>
            <h2 className="text-sm font-medium tracking-[0.2em] text-slate-400 mt-1 uppercase">Industrial Safety Monitor</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <UserIcon size={16} />
                </div>
                <input 
                  {...register("username")}
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-md py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors font-mono text-sm"
                  placeholder="Enter admin ID"
                />
              </div>
              {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">Security Key</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input 
                  {...register("password")}
                  type="password" 
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-md py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors font-mono text-sm"
                  placeholder="Enter password"
                />
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={loginMutation.isPending}
              className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-3 px-4 rounded-md transition-all active:scale-[0.98] uppercase tracking-wider text-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? "Authenticating..." : "Initialize Session"}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-800 pt-6">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
              System access restricted to authorized personnel. <br/> Activity is monitored and logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
