import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansResponse, plotsResponse] = await Promise.all([
        api.get('/plans'),
        api.get('/plots')
      ]);

      setPlans(plansResponse.data.data.plans);
      setPlots(plotsResponse.data.data.plots);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPlan = () => {
    navigate('/');
  };

  const handleDeletePlan = async (planId) => {
    try {
      await api.delete(`/plans/${planId}`);
      setPlans(plans.filter(plan => plan._id !== planId));
      toast.success('Plan deleted successfully');
    } catch (error) {
      toast.error('Failed to delete plan');
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`inline-flex items-center justify-center p-3 rounded-md ${color} text-white`}>
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={handleNewPlan}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Generate New Plan
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Plans"
            value={plans.length}
            icon="📋"
            color="bg-blue-500"
          />
          <StatCard
            title="Saved Plots"
            value={plots.length}
            icon="📐"
            color="bg-green-500"
          />
          <StatCard
            title="Total Rooms Designed"
            value={plans.reduce((total, plan) => total + (plan.layoutJson.rooms?.length || 0), 0)}
            icon="🏠"
            color="bg-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Plans */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Plans</h2>
            <div className="space-y-4">
              {plans.slice(0, 5).map((plan) => (
                <div key={plan._id} className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{plan.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                      <div className="flex space-x-4 text-xs text-gray-500 mt-2">
                        <span>{plan.layoutJson.rooms?.length || 0} rooms</span>
                        <span>{plan.layoutJson.plot.width}' x {plan.layoutJson.plot.length}'</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/editor/${plan._id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigate(`/export/${plan._id}`)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan._id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Created: {new Date(plan.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {plans.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No plans yet. Start by generating your first floor plan!
                </div>
              )}
            </div>
          </div>

          {/* Saved Plots */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Plots</h2>
            <div className="space-y-4">
              {plots.map((plot) => (
                <div key={plot._id} className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {plot.width}' x {plot.length}' Plot
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">Facing: {plot.facing}</p>
                      <div className="flex space-x-4 text-xs text-gray-500 mt-2">
                        <span>Front: {plot.setback.front}'</span>
                        <span>Back: {plot.setback.back}'</span>
                        <span>Sides: {plot.setback.left}'</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/', { state: { plot } })}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Use Plot
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Created: {new Date(plot.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {plots.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No saved plots yet. Plots will be saved when you generate plans.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleNewPlan}
              className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center"
            >
              <div className="text-2xl mb-2">🏠</div>
              <div className="font-medium">Generate New Plan</div>
              <div className="text-sm opacity-75 mt-1">Start from scratch</div>
            </button>
            
            <button
              onClick={() => navigate('/results')}
              className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-center"
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="font-medium">View All Plans</div>
              <div className="text-sm opacity-75 mt-1">Manage your designs</div>
            </button>
            
            <button
              onClick={() => navigate('/auth')}
              className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-center"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <div className="font-medium">Account Settings</div>
              <div className="text-sm opacity-75 mt-1">Manage your account</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;