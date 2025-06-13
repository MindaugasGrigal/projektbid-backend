// Mobile-optimized response formatter
const formatResponse = (data, pagination = null, meta = null) => {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (pagination) {
    response.pagination = {
      ...pagination,
      hasNext: pagination.hasMore,
      hasPrev: pagination.offset > 0
    };
  }
  
  if (meta) {
    response.meta = meta;
  }
  
  return response;
};

const formatError = (message, statusCode = 500, details = null) => {
  return {
    success: false,
    error: {
      message,
      code: statusCode,
      details,
      timestamp: new Date().toISOString()
    }
  };
};

module.exports = {
  formatResponse,
  formatError
};

