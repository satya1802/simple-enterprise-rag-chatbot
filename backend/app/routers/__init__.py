"""One router module per architecture component that owns endpoints.

`app.main` imports each module and calls `include_router`; nothing is
re-exported here so the import in main.py stays explicit about which router
is which.
"""
