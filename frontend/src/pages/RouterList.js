import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  IconButton,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useRouters } from '../context/RouterContext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpIcon from '@mui/icons-material/Help';

const RouterList = () => {
  const { routers, loading, error, deleteRouter, testConnection } = useRouters();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routerToDelete, setRouterToDelete] = useState(null);
  const [testing, setTesting] = useState({});
  const navigate = useNavigate();

  const handleEditRouter = (id) => {
    navigate(`/routers/${id}`);
  };

  const handleOpenDeleteDialog = (router) => {
    setRouterToDelete(router);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setRouterToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (routerToDelete) {
      try {
        await deleteRouter(routerToDelete.id);
        handleCloseDeleteDialog();
      } catch (error) {
        console.error('Error deleting router:', error);
      }
    }
  };

  const handleTestConnection = async (id) => {
    setTesting({ ...testing, [id]: true });
    try {
      await testConnection(id);
    } catch (error) {
      console.error('Error testing connection:', error);
    } finally {
      setTesting({ ...testing, [id]: false });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={4}>
        <Typography color="error" variant="h6">
          {error}
        </Typography>
      </Box>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'offline':
        return <CancelIcon fontSize="small" color="error" />;
      default:
        return <HelpIcon fontSize="small" color="warning" />;
    }
  };

  return (
    <Box mt={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Routers
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => navigate('/routers/add')}
        >
          Add Router
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Last Seen</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {routers.length > 0 ? (
              routers.map((router) => (
                <TableRow key={router.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {getStatusIcon(router.status)}
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {router.status.charAt(0).toUpperCase() + router.status.slice(1)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{router.name}</TableCell>
                  <TableCell>{router.ipAddress}</TableCell>
                  <TableCell>{router.hostname}</TableCell>
                  <TableCell>
                    {router.lastSeen 
                      ? new Date(router.lastSeen).toLocaleString() 
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" justifyContent="center">
                      <Tooltip title="Test Connection">
                        <IconButton 
                          color="primary"
                          onClick={() => handleTestConnection(router.id)}
                          disabled={testing[router.id]}
                        >
                          {testing[router.id] ? (
                            <CircularProgress size={24} />
                          ) : (
                            <RefreshIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Router">
                        <IconButton 
                          color="primary"
                          onClick={() => handleEditRouter(router.id)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Router">
                        <IconButton 
                          color="error"
                          onClick={() => handleOpenDeleteDialog(router)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body1" color="textSecondary">
                    No routers found. Add a router to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete router "{routerToDelete?.name}"? 
            This action cannot be undone and all associated metrics will be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RouterList; 