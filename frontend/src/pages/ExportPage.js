import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const ExportPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/plans/${planId}`);
      setPlan(response.data.data.plan);
    } catch (error) {
      toast.error('Failed to fetch plan');
      navigate('/results');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const response = await api.get(`/plans/${planId}/export/${format}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `plan-${planId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Plan exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = () => {
    try {
      const jsonString = JSON.stringify(plan.layoutJson, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `plan-${planId}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Plan exported as JSON successfully!');
    } catch (error) {
      toast.error('Failed to export as JSON');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Plan not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Export Floor Plan</h1>
          <button
            onClick={() => navigate('/results')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
          >
            Back to Results
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Info */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <p className="mt-1 text-gray-900">{plan.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-gray-900">{plan.description || 'No description'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Generated</label>
                <p className="mt-1 text-gray-900">
                  {new Date(plan.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Plot Size</label>
                <p className="mt-1 text-gray-900">
                  {plan.layoutJson.plot.width}' x {plan.layoutJson.plot.length}'
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rooms</label>
                <p className="mt-1 text-gray-900">{plan.layoutJson.rooms?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h2>
            <div className="space-y-4">
              {/* SVG Export */}
              <div className="flex justify-between items-center p-4 bg-white rounded-lg border">
                <div>
                  <h3 className="font-medium text-gray-900">SVG (Scalable Vector Graphics)</h3>
                  <p className="text-sm text-gray-600">Web-compatible vector format</p>
                </div>
                <button
                  onClick={() => handleExport('svg')}
                  disabled={exporting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
                >
                  Download SVG
                </button>
              </div>

              {/* PDF Export */}
              <div className="flex justify-between items-center p-4 bg-white rounded-lg border">
                <div>
                  <h3 className="font-medium text-gray-900">PDF (Portable Document Format)</h3>
                  <p className="text-sm text-gray-600">Print-ready document format</p>
                </div>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
                >
                  Download PDF
                </button>
              </div>

              {/* DXF Export */}
              <div className="flex justify-between items-center p-4 bg-white rounded-lg border">
                <div>
                  <h3 className="font-medium text-gray-900">DXF (AutoCAD Drawing Exchange Format)</h3>
                  <p className="text-sm text-gray-600">CAD software compatible format</p>
                </div>
                <button
                  onClick={() => handleExport('dxf')}
                  disabled={exporting}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
                >
                  Download DXF
                </button>
              </div>

              {/* JSON Export */}
              <div className="flex justify-between items-center p-4 bg-white rounded-lg border">
                <div>
                  <h3 className="font-medium text-gray-900">JSON (JavaScript Object Notation)</h3>
                  <p className="text-sm text-gray-600">Data interchange format</p>
                </div>
                <button
                  onClick={handleExportJSON}
                  disabled={exporting}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
                >
                  Download JSON
                </button>
              </div>

              {/* 3D Model Export */}
              <div className="flex justify-between items-center p-4 bg-white rounded-lg border">
                <div>
                  <h3 className="font-medium text-gray-900">3D Model (OBJ Format)</h3>
                  <p className="text-sm text-gray-600">3D visualization format</p>
                </div>
                <button
                  onClick={() => handleExport('3d')}
                  disabled={exporting}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
                >
                  Download OBJ
                </button>
              </div>
            </div>

            {exporting && (
              <div className="mt-4 flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Exporting...</span>
              </div>
            )}
          </div>
        </div>

        {/* Export Tips */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Export Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• SVG is best for web display and scaling</li>
            <li>• PDF is ideal for printing and sharing</li>
            <li>• DXF is compatible with AutoCAD and other CAD software</li>
            <li>• JSON contains all plan data for further processing</li>
            <li>• 3D models are great for visualization and walkthroughs</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;