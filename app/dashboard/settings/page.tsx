"use client";

import React from 'react'
import ProfileForm from "@/module/settings/actions/components/profile-form";
import { RepositoryList } from "@/module/settings/components/repository-list";

const SettingPage = () => {
    return (
        <div className='space-y-6'>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings and connected repositories.</p>
            </div>
            <ProfileForm />
            <RepositoryList />
        </div>
    )
}

export default SettingPage
