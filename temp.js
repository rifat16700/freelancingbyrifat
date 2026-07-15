
    document.addEventListener('DOMContentLoaded', function() {
        adminInit('dashboard', function() {
            loadDashboard();
        });

        // Greeting
        var hour = new Date().getHours();
        var greet = hour < 12 ? 'Good morning! <i data-lucide="sun" class="lucide-icon icon-spin icon-warning"></i>' : hour < 18 ? 'Good afternoon! <i data-lucide="cloud-sun" class="lucide-icon"></i>' : 'Good evening! <i data-lucide="moon" class="lucide-icon"></i>';
        document.getElementById('dashGreeting').textContent = greet;
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-BD', {day:'2-digit',month:'long',year:'numeric'});
    });


    function loadDashboard() {
        // Safety timeout — if anything hangs, force-show UI after 8s
        var loaderTimeout = setTimeout(function() {
            document.getElementById('pageLoader').style.display = 'none';
            document.getElementById('adminMain').style.display  = 'flex';
            showToast('⚠️ Some data failed to load. Check DB connection.', 'warning');
        }, 8000);

        function showUI() {
            clearTimeout(loaderTimeout);
            document.getElementById('pageLoader').style.display = 'none';
            document.getElementById('adminMain').style.display  = 'flex';
        }

        var today = new Date();
        today.setHours(0,0,0,0);

        // Total orders
        if (CONFIG.DB_PROVIDER === 'supabase') {
            supabaseClient.from('orders').select('*', { count: 'exact' })
              .order('created_at', { ascending: false })
              .then(function(r) {
            if (r.error) {
                console.error('Orders load error:', r.error);
                showToast('❌ Orders error: ' + (r.error.message || r.error), 'error');
                showUI();
                return;
            }
            var orders = r.data || [];
            var total  = r.count || orders.length;

            var todayOrders = orders.filter(function(o) {
                return new Date(o.created_at) >= today;
            });
            var pending = orders.filter(function(o) { return o.status === 'Pending'; }).length;
            var revenue = orders.filter(function(o) {
                return o.status !== 'Cancelled' && o.status !== 'Pending';
            }).reduce(function(sum, o) { return sum + (o.grand_total || 0); }, 0);

            document.getElementById('statTotal').textContent   = total;
            document.getElementById('statToday').textContent   = todayOrders.length;
            document.getElementById('statPending').textContent = pending;
            document.getElementById('statRevenue').textContent = formatMoney(revenue);

            renderRecentOrders(orders.slice(0, 10));
            buildRevenueChart(orders);
            buildBestSellers(orders);

            showUI();
            }).catch(function(err) {
                console.error('Orders fetch failed:', err);
                showToast('❌ Failed to load orders: ' + err.message, 'error');
                showUI();
            });
        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
            appwriteDatabases.listDocuments(APP_DB, 'orders', [AppwriteQuery.orderDesc('$createdAt'), AppwriteQuery.limit(5000)])
                .then(function(res) {
                    var orders = res.documents.map(function(doc) {
                        doc.id = doc.$id; doc.created_at = doc.$createdAt; if (typeof doc.gallery_images === 'string') { try { doc.gallery_images = JSON.parse(doc.gallery_images); } catch(e) { doc.gallery_images = []; } }
                        if (typeof doc.items === 'string') {
                            try { doc.items = JSON.parse(doc.items); } catch(e) { doc.items = []; }
                        }
                        return doc;
                    });
                    var total = res.total || orders.length;

                    var todayOrders = orders.filter(function(o) {
                        return new Date(o.created_at) >= today;
                    });
                    var pending = orders.filter(function(o) { return o.status === 'Pending'; }).length;
                    var revenue = orders.filter(function(o) {
                        return o.status !== 'Cancelled' && o.status !== 'Pending';
                    }).reduce(function(sum, o) { return sum + (o.grand_total || 0); }, 0);

                    document.getElementById('statTotal').textContent   = total;
                    document.getElementById('statToday').textContent   = todayOrders.length;
                    document.getElementById('statPending').textContent = pending;
                    document.getElementById('statRevenue').textContent = formatMoney(revenue);

                    renderRecentOrders(orders.slice(0, 10));
                    buildRevenueChart(orders);
                    buildBestSellers(orders);

                    showUI();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                    showUI();
                });
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            cfDbBatchQuery([{ sql: "SELECT * FROM orders ORDER BY created_at DESC" }], false)
            .then(function(d) {
                var orders = (d.success && d.result && d.result[0].results) ? d.result[0].results : [];
                orders = orders.map(function(o) {
                    if (typeof o.items === 'string') { try { o.items = JSON.parse(o.items); } catch(e){} }
                    return o;
                });
                var total = orders.length;
                var todayOrders = orders.filter(function(o) { return new Date(o.created_at) >= today; });
                var pending = orders.filter(function(o) { return o.status === 'Pending'; }).length;
                var revenue = orders.filter(function(o) { return o.status !== 'Cancelled' && o.status !== 'Pending'; }).reduce(function(sum, o) { return sum + (o.grand_total || 0); }, 0);

                document.getElementById('statTotal').textContent   = total;
                document.getElementById('statToday').textContent   = todayOrders.length;
                document.getElementById('statPending').textContent = pending;
                document.getElementById('statRevenue').textContent = formatMoney(revenue);

                renderRecentOrders(orders.slice(0, 10));
                buildRevenueChart(orders);
                buildBestSellers(orders);
                showUI();
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
                showUI();
            });
        }

        // Products count
        if (CONFIG.DB_PROVIDER === 'supabase') {
            supabaseClient.from('products').select('*', { count: 'exact', head: true })
              .eq('is_active', true)
              .then(function(r) {
                document.getElementById('statProducts').textContent = r.count || 0;
            });
        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
            appwriteDatabases.listDocuments(APP_DB, 'products', [AppwriteQuery.equal('is_active', true), AppwriteQuery.limit(1)])
                .then(function(res) {
                    document.getElementById('statProducts').textContent = res.total || 0;
                })
                .catch(function(err) { showToast('Error: ' + err.message, 'error'); });
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            cfDbBatchQuery([{ sql: "SELECT COUNT(*) as cnt FROM products WHERE is_active = 1" }], false)
            .then(function(d) {
                var count = (d.success && d.result && d.result[0].results) ? d.result[0].results[0].cnt : 0;
                document.getElementById('statProducts').textContent = count;
            });
        }
    }

    function renderRecentOrders(orders) {
        var tbody = document.getElementById('recentOrdersBody');
        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#8E8E93;padding:30px;">No orders yet</td></tr>';
            return;
        }

        var html = '';
        orders.forEach(function(o) {
            var items = o.items || [];
            var itemCount = Array.isArray(items) ? items.length : '?';
            html += '<tr>' +
                '<td><code style="font-size:12px;color:#007AFF;">' + o.id + '</code></td>' +
                '<td>' +
                    '<div style="font-weight:600;">' + (o.customer_name || '—') + '</div>' +
                    '<div style="font-size:12px;color:#8E8E93;">' + (o.customer_phone || '') + '</div>' +
                '</td>' +
                '<td>' + itemCount + ' item(s)</td>' +
                '<td style="font-weight:700;">' + formatMoney(o.grand_total) + '</td>' +
                '<td>' + payBadge(o.payment_status) + '</td>' +
                '<td>' + statusBadge(o.status) + '</td>' +
                '<td style="color:#8E8E93;font-size:12px;">' + formatDate(o.created_at) + '</td>' +
                '<td><a href="orders.html?id=' + o.id + '" class="btn btn-ghost btn-sm">View</a></td>' +
            '</tr>';
        });
        tbody.innerHTML = html;
    }

    function buildRevenueChart(orders) {
        var labels = [], data = [];

        for (var i = 6; i >= 0; i--) {
            var d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0,0,0,0);
            var nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);

            labels.push(d.toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric' }));

            var dayRevenue = orders
                .filter(function(o) {
                    var od = new Date(o.created_at);
                    return od >= d && od < nextD && o.status !== 'Cancelled';
                })
                .reduce(function(sum, o) { return sum + (o.grand_total || 0); }, 0);

            data.push(dayRevenue);
        }

        var ctx = document.getElementById('revenueChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (৳)',
                    data: data,
                    borderColor: '#007AFF',
                    backgroundColor: 'rgba(0,122,255,0.08)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#007AFF',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(19,19,31,0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: '#F5F5F7',
                        bodyColor: '#8E8E93',
                        callbacks: {
                            label: function(ctx) {
                                return ' ৳' + ctx.parsed.y.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#8E8E93', font: {size:11} }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#8E8E93', font: {size:11},
                            callback: function(v) { return '৳' + v.toLocaleString(); }
                        }
                    }
                }
            }
        });
    }

    function buildBestSellers(orders) {
        var productCounts = {};

        orders.forEach(function(o) {
            var items = o.items;
            if (!Array.isArray(items)) return;
            items.forEach(function(item) {
                var name = item.productName || item.name || 'Unknown';
                productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
            });
        });

        var sorted = Object.keys(productCounts).map(function(k) {
            return { name: k, count: productCounts[k] };
        }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);

        var rankClasses = ['gold', 'silver', 'bronze', '', ''];
        var rankLabels  = ['<i data-lucide="medal" class="lucide-icon icon-warning"></i>', '<i data-lucide="medal" class="lucide-icon"></i>', '<i data-lucide="medal" class="lucide-icon"></i>', '4', '5'];

        var html = '';
        if (!sorted.length) {
            html = '<div style="color:#8E8E93;text-align:center;padding:30px 0;font-size:13px;">No data yet</div>';
        } else {
            sorted.forEach(function(p, i) {
                html += '<div class="best-prod-item">' +
                    '<div class="best-rank ' + (rankClasses[i] || '') + '">' + rankLabels[i] + '</div>' +
                    '<div class="best-prod-name">' + p.name + '</div>' +
                    '<div class="best-prod-count">' + p.count + ' sold</div>' +
                '</div>';
            });
        }

        document.getElementById('bestSellersList').innerHTML = html;
    }
    