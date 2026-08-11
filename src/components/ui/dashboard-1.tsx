"use client"

import * as React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Filter, Users, Activity, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActivityStat {
  label: string;
  value: number; // Percentage
  color: string; // Tailwind class
}

interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface GroupInsightDashboardProps {
  title?: string;
  teamActivities: {
    totalEvents: number;
    stats: ActivityStat[];
  };
  team: {
    memberCount: number;
    members: TeamMember[];
  };
  cta?: {
    text: string;
    buttonText: string;
    onButtonClick: () => void;
  };
  className?: string;
}

const AnimatedNumber = ({ value }: { value: number }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  React.useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: "easeOut",
    });
    return controls.stop;
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
};

export const GroupInsightDashboard = React.forwardRef<
  HTMLDivElement,
  GroupInsightDashboardProps
>(({ 
  title = "Group Performance",
  teamActivities,
  team,
  cta,
  className 
}, ref) => {
  
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const hoverTransition = { type: "spring", stiffness: 300, damping: 15 } as const;

  return (
    <motion.div
      ref={ref}
      className={cn("w-full h-full text-white", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <h2 className="text-sm tracking-widest uppercase font-bold text-white/40">{title}</h2>
        <Button variant="ghost" size="icon" aria-label="Filter activities" className="hover:bg-white/5 disabled">
          <Filter className="w-4 h-4 text-white/40" />
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4">
        
        {/* Contributions Card */}
        <motion.div 
          variants={itemVariants} 
          whileHover={{ scale: 1.01, y: -2 }}
          transition={hoverTransition}
        >
          <Card className="p-4 bg-black/40 border-white/5">
            <CardContent className="p-2">
              <div className="flex items-center justify-between mb-4">
                <p className="font-medium text-xs tracking-wider uppercase text-white/50">Total Activities</p>
                <Activity className="w-4 h-4 text-white/40" />
              </div>
              <div className="mb-6">
                <span className="text-4xl font-semibold tracking-tight text-white">
                  <AnimatedNumber value={teamActivities.totalEvents} />
                </span>
                <span className="ml-2 text-white/40 text-sm font-medium">events mapped</span>
              </div>
              
              <div className="w-full h-1.5 mb-3 overflow-hidden rounded-full bg-white/5 flex">
                {teamActivities.stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    className={cn("h-full", stat.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.value}%` }}
                    transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                  />
                ))}
              </div>
              
              <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                {teamActivities.stats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", stat.color)}></span>
                    <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">{stat.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Card */}
        <motion.div 
          variants={itemVariants}
          whileHover={{ scale: 1.01, y: -2 }}
          transition={hoverTransition}
        >
          <Card className="p-4 bg-white/[0.02] border-white/10">
            <CardContent className="p-2">
              <div className="flex items-center justify-between mb-4">
                <p className="font-medium text-xs tracking-wider uppercase text-white/70">Team Scope</p>
                <Users className="w-4 h-4 text-white/60" />
              </div>
              <div className="mb-6">
                <span className="text-4xl font-semibold tracking-tight text-white">
                   <AnimatedNumber value={team.memberCount} />
                </span>
                <span className="ml-2 text-white/40 text-sm font-medium">attributions</span>
              </div>
              
              <div className="flex -space-x-2">
                {team.members.slice(0, 5).map((member, index) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                    whileHover={{ scale: 1.2, zIndex: 10, y: -2 }}
                  >
                    <Avatar className="border-2 border-black/80 h-10 w-10">
                      <AvatarImage src={member.avatarUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`} alt={member.name} />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {cta && (
         <motion.div 
            variants={itemVariants} 
            whileHover={{ scale: 1.02 }}
            transition={hoverTransition}
            className="mt-6"
         >
            <div className="flex flex-col sm:flex-row items-center sm:justify-between p-4 rounded-xl bg-white/5 border border-white/5 gap-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded-full bg-white/10">
                     <ExternalLink className="w-4 h-4 text-white" />
                 </div>
                 <p className="text-sm font-medium text-white/60">{cta.text}</p>
               </div>
               <Button onClick={cta.onButtonClick} className="shrink-0 w-full sm:w-auto bg-white/10 border-white/20">
                   {cta.buttonText}
                   <ArrowRight className="w-4 h-4 ml-2" />
               </Button>
            </div>
         </motion.div>
      )}
    </motion.div>
  );
});

GroupInsightDashboard.displayName = "GroupInsightDashboard";
