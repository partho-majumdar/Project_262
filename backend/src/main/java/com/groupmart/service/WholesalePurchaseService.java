package com.groupmart.service;

import com.groupmart.entity.WholesalePool;

/**
 * Converts a just-completed CWP pool into its confirmed parent purchase and one individual order
 * per reservation (CWP spec sections 7-9 and 23). Called from within the same transaction that
 * flips a pool to COMPLETED, with the pool row already locked by the caller.
 */
public interface WholesalePurchaseService {

    void completePool(WholesalePool pool);
}
