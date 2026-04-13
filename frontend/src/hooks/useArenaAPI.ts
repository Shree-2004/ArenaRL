import { useState, useEffect, useCallback } from 'react';
import { api, mockGames, type Agent, type Game, type TrainingProgress } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// Check if API is available, otherwise use mock data
const USE_MOCK = false; // Set to false when Python backend is running

export function useAgents(skipRedirect: boolean = false) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAgents(skipRedirect);
      setAgents(data);
      setError(null);
    } catch (err) {
      if (!skipRedirect) {
        setError(err instanceof Error ? err.message : 'Backend Handshake Failed');
        toast({
          title: "Connection Error",
          description: "Could not connect to the AI Backend server (Port 5000).",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [skipRedirect]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const deleteAgent = async (agentId: string) => {
    try {
      await api.deleteAgent(agentId);
      toast({
        title: "Agent Deleted",
        description: "The agent has been removed from your research portal.",
      });
      fetchAgents(); // Refresh the list
      return true;
    } catch (err) {
      toast({
        title: "Deletion Failed",
        description: err instanceof Error ? err.message : "Error deleting agent",
        variant: "destructive"
      });
      return false;
    }
  };

  return { agents, loading, error, refetch: fetchAgents, deleteAgent };
}

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Games list is static in this version as per mockGames definition
    setGames(mockGames);
    setLoading(false);
  }, []);

  return { games, loading, error };
}

export function useTraining() {
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  const startTraining = useCallback(async (
    name: string,
    game: string,
    episodes: number,
    algorithm: string,
    learningRate: number = 0.001
  ) => {
    setIsTraining(true);
    try {
      const result = await api.createAgent({
        name,
        game,
        episodes,
        algorithm,
        learningRate
      });

      setAgentId(result.agent_id);

      // Build config to send via socket when starting training
      const trainingConfig = { name, game, episodes, algorithm, learningRate };

      // Connect to Socket.IO for progress — training starts only AFTER room join is confirmed
      api.connectTraining(result.agent_id, trainingConfig, (update) => {
        setProgress((prev) => {
          const newLogs = update.log
            ? [...(prev?.logs || []), update.log].slice(-50)
            : prev?.logs || [];

          return {
            agent_id: update.agent_id,
            episode: update.episode,
            reward: update.reward,
            status: update.status,
            currentEpisode: update.episode,
            totalEpisodes: episodes,
            winRate: update.winRate || prev?.winRate || 0,
            avgReward: update.reward,
            epsilon: update.epsilon || prev?.epsilon || 0,
            rewardHistory: update.rewardHistory || prev?.rewardHistory || [],
            winRateHistory: update.winRateHistory || prev?.winRateHistory || [],
            sps: update.sps,
            board: update.board,
            logs: newLogs
          };
        });

        if (update.status === 'completed') {
          setIsTraining(false);
          toast({
            title: "Training Complete",
            description: `Agent ${name} has finished training!`,
          });
        }
      });

    } catch (err) {
      setIsTraining(false);
      toast({
        title: "Training Failed",
        description: err instanceof Error ? err.message : "Error starting training",
        variant: "destructive"
      });
    }
  }, []);

  const stopTraining = useCallback(() => {
    api.disconnect();
    setIsTraining(false);
  }, []);

  useEffect(() => {
    return () => {
      api.disconnect();
    };
  }, []);

  return { progress, isTraining, startTraining, stopTraining };
}

export function useStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const data = await api.getDashboard();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  return { stats, loading, error };
}

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard().then(setLeaderboard).finally(() => setLoading(false));
  }, []);

  return { leaderboard, loading };
}

export function useMatch(gameId: string) {
  const [matchState, setMatchState] = useState<any>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      api.disconnect();
    };
  }, []);

  const startMatch = (agent1Id: string, agent2Id: string) => {
    api.connectArena((data) => {
      if (data.match_id) setMatchId(data.match_id);
      setMatchState((prev: any) => ({
        ...prev,
        ...data,
        agentX: { name: agent1Id }, // Simple mapping for UI
        agentO: { name: agent2Id },
        moveHistory: [] // Handled by backend state
      }));
    });

    api.startMatch(agent1Id, agent2Id, gameId);
  };

  const makeMove = (position: [number, number]) => {
    // Human moves not fully implemented in backend yet, would emit here
  };

  const resetMatch = () => {
    setMatchState(null);
    api.disconnect();
  };

  return { matchState, startMatch, makeMove, resetMatch };
}
