// Admin Products Management JavaScript
document.addEventListener('DOMContentLoaded', function() {
    
    // Helper function to create pagination URL
    function createPaginationUrl(page, currentParams = {}) {
        const url = new URL(window.location);
        const params = new URLSearchParams(url.search);
        
        // Update or add page parameter
        params.set('page', page);
        
        // Preserve other parameters
        Object.keys(currentParams).forEach(key => {
            if (currentParams[key]) {
                params.set(key, currentParams[key]);
            }
        });
        
        return `${url.pathname}?${params.toString()}`;
    }
    
    // Server-side search with optimized debounce
    const searchInput = document.getElementById('search');
    const categorySelect = document.getElementById('category');
    const sortSelect = document.getElementById('sort');
    const limitSelect = document.getElementById('limit');
    
    let searchTimeout;
    
    // Get the filter form specifically
    const filterForm = document.querySelector('form[action="/admin/products"]');
    
    if (!filterForm) {
        return;
    }
    
    // Optimized auto-submit with debounce for all inputs
    const allInputs = [searchInput, categorySelect, sortSelect, limitSelect].filter(Boolean);
    
    allInputs.forEach(input => {
        if (input) {
                    const eventType = input.type === 'text' ? 'input' : 'change';
        input.addEventListener(eventType, function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (filterForm) {
                    filterForm.submit();
                }
            }, 500);
        });
        }
    });
    
    // Add loading state to form
    const form = filterForm;
    if (form) {
        form.addEventListener('submit', function() {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lọc...';
                submitBtn.disabled = true;
            }
        });
    }
    
    // Add confirmation for delete actions
    const deleteButtons = document.querySelectorAll('form[action="/admin/delete-product"]');
    deleteButtons.forEach(form => {
        form.addEventListener('submit', function(e) {
            const productName = this.closest('tr').querySelector('td:nth-child(2)').textContent.trim();
            if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${productName}"?`)) {
                e.preventDefault();
            }
        });
    });
    
    // Add tooltips for better UX
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg';
            tooltip.textContent = this.getAttribute('data-tooltip');
            tooltip.style.left = this.offsetLeft + 'px';
            tooltip.style.top = (this.offsetTop - 30) + 'px';
            document.body.appendChild(tooltip);
            this._tooltip = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
    
    // Highlight search terms in results
    const searchTerm = new URLSearchParams(window.location.search).get('search');
    if (searchTerm) {
        const productTitles = document.querySelectorAll('td:nth-child(2)');
        productTitles.forEach(cell => {
            const text = cell.textContent;
            const highlightedText = text.replace(
                new RegExp(searchTerm, 'gi'),
                match => `<mark class="bg-yellow-200 px-1 rounded">${match}</mark>`
            );
            cell.innerHTML = highlightedText;
        });
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Escape to clear filters
        if (e.key === 'Escape') {
            window.location.href = '/admin/products';
        }
        
        // Arrow keys for pagination (if on pagination page)
        const currentPage = parseInt(new URLSearchParams(window.location.search).get('page')) || 1;
        const totalPages = parseInt(document.querySelector('[data-total-pages]')?.dataset.totalPages) || 1;
        
        if (e.key === 'ArrowLeft' && currentPage > 1) {
            e.preventDefault();
            const prevUrl = createPaginationUrl(currentPage - 1, {
                search: searchInput?.value,
                category: categorySelect?.value,
                sort: sortSelect?.value,
                limit: limitSelect?.value
            });
            window.location.href = prevUrl;
        }
        
        if (e.key === 'ArrowRight' && currentPage < totalPages) {
            e.preventDefault();
            const nextUrl = createPaginationUrl(currentPage + 1, {
                search: searchInput?.value,
                category: categorySelect?.value,
                sort: sortSelect?.value,
                limit: limitSelect?.value
            });
            window.location.href = nextUrl;
        }
    });
    
    // Add export functionality
    const exportBtn = document.createElement('button');
    exportBtn.className = 'bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center gap-2';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Xuất Excel';
    exportBtn.addEventListener('click', function() {
        const currentUrl = new URL(window.location);
        currentUrl.pathname = '/admin/export-products';
        window.open(currentUrl.toString(), '_blank');
    });
    
    // Add export button to the page
    const headerActions = document.querySelector('.flex.flex-col.md\\:flex-row.md\\:items-center.md\\:justify-between');
    if (headerActions) {
        const actionsDiv = headerActions.querySelector('div:last-child');
        if (actionsDiv) {
            actionsDiv.appendChild(exportBtn);
        }
    }
    
    // Add pagination info to page for keyboard navigation
    const paginationInfo = document.createElement('div');
    paginationInfo.style.display = 'none';
    paginationInfo.dataset.totalPages = document.querySelector('.text-sm.text-gray-700')?.textContent.match(/Trang \d+ \/ (\d+)/)?.[1] || '1';
    document.body.appendChild(paginationInfo);
}); 